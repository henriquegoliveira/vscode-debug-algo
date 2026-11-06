import * as vscode from 'vscode';
import { ExtensionMessage, GraphSnapshot, PROTOCOL_VERSION } from 'dbga-contract';

export interface SnapshotChannel {
  post(message: ExtensionMessage): void;
  dispose(): void;
}

export const DEFAULT_HISTORY_DEPTH = 20;
export const HISTORY_MAX_BYTES = 16 * 1024 * 1024;

interface HistoryEntry {
  snapshot: GraphSnapshot;
  bytes: number;
}

export class SnapshotBroker implements vscode.Disposable {
  private readonly channels: SnapshotChannel[] = [];
  private history: HistoryEntry[] = [];
  private historyBytes = 0;
  private lastSessionId: string | undefined;
  private lastFile: string | null = null;
  private sessionEnded = false;

  constructor(
    private readonly readView: (file: string | null) => unknown = () => null,
    private readonly readDepth: () => number = () => DEFAULT_HISTORY_DEPTH,
  ) {}

  public register(channel: SnapshotChannel): void {
    this.channels.push(channel);
  }

  public publish(snapshot: GraphSnapshot, session: vscode.DebugSession, file: string | null): void {
    if (this.lastSessionId !== session.id) {
      this.clearHistory();
    }

    const depth = this.remember(snapshot);
    const restarted = this.lastSessionId !== session.id;
    this.lastSessionId = session.id;
    this.lastFile = file ?? (restarted ? null : this.lastFile);
    this.sessionEnded = false;

    this.broadcast({
      v: PROTOCOL_VERSION,
      type: 'snapshot',
      sessionId: session.id,
      snapshot,
      depth,
    });
    this.broadcast(this.viewMessage());
  }

  public publishSessionEnd(session: vscode.DebugSession): void {
    if (this.lastSessionId !== session.id) {
      return;
    }

    this.sessionEnded = true;
    this.broadcast({ v: PROTOCOL_VERSION, type: 'sessionEnd', sessionId: session.id });
  }

  public publishError(message: string, session: vscode.DebugSession | undefined): void {
    this.broadcast({
      v: PROTOCOL_VERSION,
      type: 'error',
      sessionId: session?.id ?? null,
      message,
    });
  }

  public replay(channel: SnapshotChannel): void {
    channel.post({
      v: PROTOCOL_VERSION,
      type: 'locale',
      language: vscode.env.language,
      bundle: vscode.l10n.bundle,
    });

    if (this.history.length === 0 || this.lastSessionId === undefined) {
      return;
    }

    channel.post({
      v: PROTOCOL_VERSION,
      type: 'history',
      sessionId: this.lastSessionId,
      entries: this.history.map((entry) => entry.snapshot),
    });
    channel.post(this.viewMessage());

    if (this.sessionEnded) {
      channel.post({
        v: PROTOCOL_VERSION,
        type: 'sessionEnd',
        sessionId: this.lastSessionId,
      });
    }
  }

  public dispose(): void {
    this.channels.forEach((channel) => channel.dispose());
    this.channels.length = 0;
    this.clearHistory();
    this.lastSessionId = undefined;
    this.lastFile = null;
    this.sessionEnded = false;
  }

  private remember(snapshot: GraphSnapshot): number {
    const bytes = JSON.stringify(snapshot).length;
    this.history.push({ snapshot, bytes });
    this.historyBytes += bytes;

    const depth = this.depth();
    while (
      this.history.length > depth ||
      (this.history.length > 1 && this.historyBytes > HISTORY_MAX_BYTES)
    ) {
      const dropped = this.history.shift();
      if (dropped === undefined) {
        break;
      }
      this.historyBytes -= dropped.bytes;
    }

    return depth;
  }

  private depth(): number {
    const requested = this.readDepth();
    if (!Number.isFinite(requested)) {
      return DEFAULT_HISTORY_DEPTH;
    }
    return Math.max(1, Math.floor(requested));
  }

  private clearHistory(): void {
    this.history = [];
    this.historyBytes = 0;
  }

  private viewMessage(): ExtensionMessage {
    return {
      v: PROTOCOL_VERSION,
      type: 'view',
      file: this.lastFile,
      state: this.readView(this.lastFile),
    };
  }

  private broadcast(message: ExtensionMessage): void {
    this.channels.forEach((channel) => channel.post(message));
  }
}
