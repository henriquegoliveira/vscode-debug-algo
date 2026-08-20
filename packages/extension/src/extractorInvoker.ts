import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { DebuggerType } from './debuggerType';
import { SnapshotReader } from './snapshotReader';
import { GraphSnapshot } from './graphSnapshot';

export interface ExtractionLimits {
  maxNodes?: number;
  maxEdges?: number;
}

export interface ExtractionOptions {
  dynamicArrays?: string[];
  rootFilter?: string[];
  limits?: ExtractionLimits;
}

export interface InvokeOptions {
  importModule: boolean;
  options: ExtractionOptions;
  pid: number;
  threadId: number;
}

export class DebuggerPythonMissingError extends Error {
  constructor(
    readonly debuggerType: DebuggerType,
    readonly cause: unknown,
  ) {
    super(
      `O ${debuggerType} desta maquina foi compilado sem Python embutido, entao o DbgAlgo nao ` +
        'consegue injetar o extrator. No Windows, instale o GDB do MinGW-w64 ' +
        '(mingw-w64-x86_64-gdb no MSYS2);',
    );
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
  ): Promise<GraphSnapshot> {
    const frameId = await this.resolveFrameId(session, options.threadId);
    const snapshotPath = this.snapshotPathFor(options.pid);

    if (options.importModule) {
      try {
        await this.sendEvaluate(session, type, this.importCommand(type), frameId);
      } catch (err) {
        if (isPythonMissing(err)) {
          throw new DebuggerPythonMissingError(type, err);
        }
        throw err;
      }
    }

    await this.sendEvaluate(
      session,
      type,
      this.dumpCommand(type, snapshotPath, options.options),
      frameId,
    );

    return this.reader.read(snapshotPath);
  }

  private async resolveFrameId(session: vscode.DebugSession, threadId: number): Promise<number> {
    const response = await session.customRequest('stackTrace', {
      threadId,
      startFrame: 0,
      levels: 1,
    });

    const frame = response?.stackFrames?.[0];
    if (frame === undefined) {
      throw new Error(
        `nao consegui resolver o frame da thread ${threadId}: stackTrace voltou sem frames`,
      );
    }

    return frame.id;
  }

  private snapshotPathFor(pid: number): string {
    return path.join(os.tmpdir(), `dbg-algo-snapshot-${pid}.json`);
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

function isPythonMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return PYTHON_MISSING_PATTERNS.some((pattern) => pattern.test(message));
}
