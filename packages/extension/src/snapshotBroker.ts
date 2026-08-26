import * as vscode from 'vscode';
import { ExtensionMessage, GraphSnapshot, PROTOCOL_VERSION } from 'dbga-contract';

export interface SnapshotChannel {
  post(message: ExtensionMessage): void;
  dispose(): void;
}

export class SnapshotBroker implements vscode.Disposable {
  private readonly channels: SnapshotChannel[] = [];
  private lastSnapshot: GraphSnapshot | undefined;
  private lastSessionId: string | undefined;
  private sessionEnded = false;

  public register(channel: SnapshotChannel): void {
    this.channels.push(channel);
  }

  public publish(snapshot: GraphSnapshot, session: vscode.DebugSession): void {
    this.lastSnapshot = snapshot;
    this.lastSessionId = session.id;
    this.sessionEnded = false;

    this.broadcast({
      v: PROTOCOL_VERSION,
      type: 'snapshot',
      sessionId: session.id,
      snapshot,
    });
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
    if (this.lastSnapshot === undefined || this.lastSessionId === undefined) {
      return;
    }

    channel.post({
      v: PROTOCOL_VERSION,
      type: 'snapshot',
      sessionId: this.lastSessionId,
      snapshot: this.lastSnapshot,
    });

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
    this.lastSnapshot = undefined;
    this.lastSessionId = undefined;
    this.sessionEnded = false;
  }

  private broadcast(message: ExtensionMessage): void {
    this.channels.forEach((channel) => channel.post(message));
  }
}
