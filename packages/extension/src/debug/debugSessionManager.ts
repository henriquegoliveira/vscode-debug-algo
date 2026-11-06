import * as vscode from 'vscode';
import { DebuggerType } from './debuggerType';
import { DebuggerPythonMissingError, ExtractorInvoker } from './extractorInvoker';
import { readExtractionOptions } from './extractionSettings';
import { suggestLldbOnWindows } from './debuggerAvailability';
import { GraphSnapshot } from 'dbga-contract';

export class DebugSessionManager implements vscode.Disposable {
  private currentSession: vscode.DebugSession | undefined;

  private readonly importedSessions = new Set<string>();

  private readonly sessionPids = new Map<string, number>();

  private readonly extractingSessions = new Set<string>();

  private readonly pendingPauses = new Map<string, { type: DebuggerType; threadId: number }>();

  private readonly unusableSessions = new Set<string>();

  private readonly reportedSessions = new Set<string>();

  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly invoker: ExtractorInvoker,
    private readonly state: vscode.Memento,
    private readonly onSnapshot: (
      snapshot: GraphSnapshot,
      session: vscode.DebugSession,
      file: string | null,
    ) => void,
    private readonly onError: (message: string, session: vscode.DebugSession) => void,
  ) {
    this.disposables.push(
      vscode.debug.onDidChangeActiveDebugSession((session) => {
        this.currentSession = session;
      }),

      vscode.debug.onDidTerminateDebugSession((session) => {
        this.importedSessions.delete(session.id);
        this.sessionPids.delete(session.id);
        this.extractingSessions.delete(session.id);
        this.pendingPauses.delete(session.id);
        this.unusableSessions.delete(session.id);
        this.reportedSessions.delete(session.id);
        if (this.currentSession?.id === session.id) {
          this.currentSession = undefined;
        }
      }),

      vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker: (session: vscode.DebugSession) => ({
          onDidSendMessage: (message: unknown) => this.handleDapMessage(session, message),
        }),
      }),
    );
  }

  private handleDapMessage(session: vscode.DebugSession, message: unknown): void {
    const processInfo = asProcessEvent(message) ?? asLaunchedProcessOutput(message);
    if (processInfo !== undefined) {
      this.sessionPids.set(session.id, processInfo.systemProcessId);
      return;
    }

    const stoppedInfo = asStoppedEvent(message);
    if (stoppedInfo === undefined) {
      return;
    }

    const type = this.detectDebuggerType(session);
    if (type === undefined) {
      return;
    }

    void this.onSessionStopped(session, type, stoppedInfo.threadId);
  }

  private async onSessionStopped(
    session: vscode.DebugSession,
    type: DebuggerType,
    threadId: number,
    opportunistic = false,
  ): Promise<void> {
    const pid = this.sessionPids.get(session.id);
    if (pid == undefined) {
      console.warn(
        `[DebugAlgo] session ${session.id} stopped before the PID of the debuggee was captured`,
      );
      return;
    }

    if (this.unusableSessions.has(session.id)) {
      return;
    }

    if (this.extractingSessions.has(session.id)) {
      this.pendingPauses.set(session.id, { type, threadId });
      return;
    }

    const firstPauseThisSession = !this.importedSessions.has(session.id);
    if (firstPauseThisSession) {
      void suggestLldbOnWindows(this.state, type);
    }

    this.extractingSessions.add(session.id);

    try {
      const extraction = await this.invoker.invoke(session, type, {
        importModule: firstPauseThisSession,
        options: readExtractionOptions(),
        pid,
        threadId,
      });
      this.importedSessions.add(session.id);
      this.onSnapshot(extraction.snapshot, session, extraction.file);
    } catch (err) {
      if (err instanceof DebuggerPythonMissingError) {
        this.unusableSessions.add(session.id);
        this.onError(err.message, session);
        void vscode.window.showErrorMessage(err.message);
        return;
      }
      console.error(
        `[DebugAlgo] failed to extract or read the snapshot of session ${session.id}`,
        err,
      );

      if (opportunistic) {
        return;
      }

      const message = vscode.l10n.t(
        'DebugAlgo could not extract the structures at this pause: {0}',
        err instanceof Error ? err.message : String(err),
      );

      this.onError(message, session);

      if (!this.reportedSessions.has(session.id)) {
        this.reportedSessions.add(session.id);
        void vscode.window.showErrorMessage(message);
      }
    } finally {
      this.extractingSessions.delete(session.id);

      const pending = this.pendingPauses.get(session.id);
      if (pending !== undefined) {
        this.pendingPauses.delete(session.id);
        void this.onSessionStopped(session, pending.type, pending.threadId, true);
      }
    }
  }

  detectDebuggerType(
    session: vscode.DebugSession | undefined = this.currentSession,
  ): DebuggerType | undefined {
    switch (session?.type) {
      case 'cppdbg':
        return DebuggerType.GDB;
      case 'lldb':
        return DebuggerType.LLDB;
      default:
        return undefined;
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

function asStoppedEvent(message: unknown): { threadId: number } | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const candidate = message as { type?: unknown; event?: unknown; body?: unknown };
  if (candidate.type !== 'event' || candidate.event !== 'stopped') {
    return undefined;
  }
  const body = candidate.body as { threadId?: unknown } | undefined;
  if (typeof body?.threadId !== 'number') {
    return undefined;
  }

  return { threadId: body.threadId };
}

function asLaunchedProcessOutput(message: unknown): { systemProcessId: number } | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const candidate = message as { type?: unknown; event?: unknown; body?: unknown };
  if (candidate.type !== 'event' || candidate.event !== 'output') {
    return undefined;
  }
  const body = candidate.body as { category?: unknown; output?: unknown } | undefined;
  if (body?.category !== 'console' || typeof body.output !== 'string') {
    return undefined;
  }
  const match = /^Launched process (\d+) from/.exec(body.output);
  if (match === null) {
    return undefined;
  }
  return { systemProcessId: Number(match[1]) };
}

function asProcessEvent(message: unknown): { systemProcessId: number } | undefined {
  if (typeof message !== 'object' || message === null) {
    return undefined;
  }
  const candidate = message as { type?: unknown; event?: unknown; body?: unknown };
  if (candidate.type !== 'event' || candidate.event !== 'process') {
    return undefined;
  }
  const body = candidate.body as { systemProcessId?: unknown } | undefined;
  if (typeof body?.systemProcessId !== 'number') {
    return undefined;
  }

  return { systemProcessId: body.systemProcessId };
}
