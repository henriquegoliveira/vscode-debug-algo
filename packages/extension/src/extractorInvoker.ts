import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { DebuggerType } from './debuggerType';
import { SnapshotReader } from './snapshotReader';
import { GraphSnapshot } from './graphSnapshot';

export interface InvokeOptions {
  importModule: boolean;
  rootVar?: string;
  pid: number;
  threadId: number;
}

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
      await this.sendEvaluate(session, type, this.importCommand(type), frameId);
    }
    await this.sendEvaluate(
      session,
      type,
      this.dumpCommand(type, snapshotPath, options.rootVar),
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
      console.log(`nao consegui resolver o frame da thread ${threadId} (stackTrace vazio)`);
    }

    return frame.id;
  }

  private snapshotPathFor(pid: number): string {
    return path.join(os.tmpdir(), `dbg-algo-snapshot-${pid}.json`);
  }

  private scriptPathFor(type: DebuggerType): string {
    const filename = type === DebuggerType.GDB ? 'extractor_gdb.py' : 'extractor_lldb.py';
    return path.join(this.extensionPath, 'scripts', filename);
  }

  private moduleNameFor(type: DebuggerType): string {
    return path.basename(this.scriptPathFor(type), '.py');
  }

  private importCommand(type: DebuggerType): string {
    const scriptDir = path.dirname(this.scriptPathFor(type));
    const moduleName = this.moduleNameFor(type);

    return `import sys; \
            sys.path.insert(0, ${JSON.stringify(scriptDir)}); \
            import ${moduleName}`;
  }

  private dumpCommand(type: DebuggerType, outPath: string, rootVar?: string): string {
    const moduleName = this.moduleNameFor(type);
    const args = [JSON.stringify(outPath)];
    if (rootVar !== undefined) {
      args.push(JSON.stringify(rootVar));
    }
    return `${moduleName}.dump_structs(${args.join(', ')})`;
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
