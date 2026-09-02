import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { DebuggerType } from './debuggerType';
import { SnapshotReader } from './snapshotReader';
import { GraphSnapshot } from 'dbga-contract';

export interface ExtractionLimits {
  maxNodes?: number;
  maxEdges?: number;
  maxCells?: number;
}

export interface ExtractionOptions {
  dynamicArrays?: string[];
  rootFilter?: string[];
  limits?: ExtractionLimits;
}

export interface Extraction {
  snapshot: GraphSnapshot;
  file: string | null;
}

export interface InvokeOptions {
  importModule: boolean;
  options: ExtractionOptions;
  pid: number;
  threadId: number;
}

const PYTHON_MISSING_MESSAGE =
  'DbgAlgo precisa de um depurador com Python embutido e o desta sessão não tem. ' +
  'Use o CodeLLDB, que traz o próprio LLDB, ou um GDB com Python ' +
  '(no Windows, mingw-w64-x86_64-gdb pelo MSYS2).';

const FRAME_LEVELS = 20;

const PROBE_ATTEMPTS = 4;
const PROBE_BACKOFF_MS = 10;

const PYTHON_PROBE_MESSAGE =
  'DbgAlgo injetou Python no depurador e nada foi escrito em disco. As duas causas possíveis são ' +
  'um depurador sem Python embutido e um caminho de arquivo que não sobreviveu ao console do ' +
  'depurador. Confira se o GDB tem Python (gdb --configuration) e se a pasta temporária do sistema ' +
  'é gravável.';

export class DebuggerPythonMissingError extends Error {
  constructor(
    readonly debuggerType: DebuggerType,
    readonly cause: unknown,
    message: string = PYTHON_MISSING_MESSAGE,
  ) {
    super(message);
    this.name = 'DebuggerPythonMissingError';
  }
}

const PYTHON_MISSING_PATTERNS = [
  /python scripting is not supported/i,
  /undefined command: "python"/i,
  /scripting in the "python" language is not supported/i,
];

export class ExtractorInvoker {
  constructor(
    private readonly extensionPath: string,
    private readonly reader: SnapshotReader,
  ) {}

  async invoke(
    session: vscode.DebugSession,
    type: DebuggerType,
    options: InvokeOptions,
  ): Promise<Extraction> {
    const snapshotPath = this.snapshotPathFor(options.pid);
    let frame = await this.resolveFrame(session, options.threadId);

    try {
      await this.inject(session, type, options, frame.id, snapshotPath);
    } catch (err) {
      if (err instanceof DebuggerPythonMissingError) {
        throw err;
      }

      frame = await this.resolveFrame(session, options.threadId);
      await this.inject(session, type, options, frame.id, snapshotPath);
    }

    const snapshot = await this.reader.read(snapshotPath);

    return { snapshot, file: relativeSource(frame) ?? snapshot.frames[0]?.file ?? null };
  }

  private async inject(
    session: vscode.DebugSession,
    type: DebuggerType,
    options: InvokeOptions,
    frameId: number,
    snapshotPath: string,
  ): Promise<void> {
    if (options.importModule) {
      await this.probePython(session, type, frameId, options.pid);

      try {
        await this.sendEvaluate(session, type, this.importCommand(type), frameId);
      } catch (err) {
        if (isPythonMissing(err)) {
          throw new DebuggerPythonMissingError(type, err);
        }
        throw err;
      }
    }

    await fs.rm(snapshotPath, { force: true });

    await this.sendEvaluate(
      session,
      type,
      this.dumpCommand(type, snapshotPath, options.options),
      frameId,
    );
  }

  private async resolveFrame(
    session: vscode.DebugSession,
    threadId: number,
  ): Promise<{ id: number; path: string | undefined }> {
    const response = await session.customRequest('stackTrace', {
      threadId,
      startFrame: 0,
      levels: FRAME_LEVELS,
    });

    const frames = response?.stackFrames;
    const frame = frames?.[0];
    if (frame === undefined) {
      throw new Error(
        `nao consegui resolver o frame da thread ${threadId}: stackTrace voltou sem frames`,
      );
    }

    const sourced = frames.find(
      (entry: { source?: { path?: string } }) =>
        typeof entry.source?.path === 'string' && entry.source.path.length > 0,
    );

    return { id: frame.id, path: sourced?.source?.path };
  }

  private snapshotPathFor(pid: number): string {
    return path.join(os.tmpdir(), `dbg-algo-snapshot-${pid}.json`);
  }

  private probePathFor(pid: number): string {
    return path.join(os.tmpdir(), `dbg-algo-probe-${pid}.txt`);
  }

  private async probePython(
    session: vscode.DebugSession,
    type: DebuggerType,
    frameId: number,
    pid: number,
  ): Promise<void> {
    const probePath = this.probePathFor(pid);
    await fs.rm(probePath, { force: true });

    try {
      await this.sendEvaluate(
        session,
        type,
        `__import__("io").open(${JSON.stringify(probePath)}, "w").close()`,
        frameId,
      );
    } catch (err) {
      if (isPythonMissing(err)) {
        throw new DebuggerPythonMissingError(type, err);
      }
      throw new DebuggerPythonMissingError(type, err, PYTHON_PROBE_MESSAGE);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
      try {
        await fs.access(probePath);
        await fs.rm(probePath, { force: true });
        return;
      } catch (err) {
        lastError = err;
        if (attempt < PROBE_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, PROBE_BACKOFF_MS * 2 ** attempt));
        }
      }
    }

    throw new DebuggerPythonMissingError(type, lastError, PYTHON_PROBE_MESSAGE);
  }

  private scriptPathFor(type: DebuggerType): string {
    const filename = type === DebuggerType.GDB ? 'dbga_extractor_gdb.py' : 'dbga_extractor_lldb.py';
    return path.join(this.extensionPath, 'scripts', filename);
  }

  private moduleNameFor(type: DebuggerType): string {
    return path.basename(this.scriptPathFor(type), '.py');
  }

  private importCommand(type: DebuggerType): string {
    const scriptDir = path.dirname(this.scriptPathFor(type));
    const moduleName = this.moduleNameFor(type);

    return `import sys; sys.path.insert(0, ${JSON.stringify(scriptDir)}); import ${moduleName}`;
  }

  private dumpCommand(type: DebuggerType, outPath: string, options: ExtractionOptions): string {
    const moduleName = this.moduleNameFor(type);
    const literal = `__import__("json").loads(${JSON.stringify(JSON.stringify(options))})`;

    return `${moduleName}.dump_structs(${JSON.stringify(outPath)}, options=${literal})`;
  }

  private async sendEvaluate(
    session: vscode.DebugSession,
    type: DebuggerType,
    pythonCode: string,
    frameId: number,
  ): Promise<unknown> {
    const expression =
      type === DebuggerType.GDB ? `-exec python ${pythonCode}` : `script ${pythonCode}`;

    return session.customRequest('evaluate', { expression, context: 'repl', frameId });
  }
}

export async function sweepStaleTempFiles(): Promise<void> {
  const directory = os.tmpdir();

  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith('.dbg-algo-snapshot-') && entry.endsWith('.tmp')) {
      await fs.rm(path.join(directory, entry), { force: true });
    }
  }
}

function isPythonMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return PYTHON_MISSING_PATTERNS.some((pattern) => pattern.test(message));
}

function relativeSource(frame: { path: string | undefined }): string | null {
  if (frame.path === undefined || frame.path.length === 0) {
    return null;
  }

  return vscode.workspace.asRelativePath(frame.path, false).split(path.sep).join('/');
}
