import { type ExtensionMessage, type GraphSnapshot, PROTOCOL_VERSION } from 'dbga-contract';
import { type SnapshotListener, deliver } from 'dbga-webview/src/session/channel';

const HISTORY_DEPTH = 20;

export interface PlayerState {
  pause: number;
  total: number;
  finished: boolean;
  line: number | null;
}

export class Player {
  private index = 0;
  private run = 1;
  private finished = false;
  private listener: SnapshotListener | null = null;
  private readonly watchers = new Set<() => void>();
  private state: PlayerState;

  constructor(
    private readonly snapshots: GraphSnapshot[],
    private readonly language: string,
    private readonly bundle: Record<string, string> | undefined,
  ) {
    this.state = this.capture();
  }

  readonly connect = (onMessage: SnapshotListener): (() => void) => {
    this.listener = onMessage;
    this.send({
      v: PROTOCOL_VERSION,
      type: 'locale',
      language: this.language,
      bundle: this.bundle,
    });
    this.sendPause();
    return () => {
      this.listener = null;
    };
  };

  readonly subscribe = (watcher: () => void): (() => void) => {
    this.watchers.add(watcher);
    return () => this.watchers.delete(watcher);
  };

  readonly snapshot = (): PlayerState => this.state;

  next(): void {
    if (this.finished) {
      return;
    }
    if (this.index < this.snapshots.length - 1) {
      this.index += 1;
      this.sendPause();
    } else {
      this.finished = true;
      this.send({ v: PROTOCOL_VERSION, type: 'sessionEnd', sessionId: this.sessionId() });
    }
    this.changed();
  }

  restart(): void {
    this.run += 1;
    this.index = 0;
    this.finished = false;
    this.sendPause();
    this.changed();
  }

  private sendPause(): void {
    this.send({
      v: PROTOCOL_VERSION,
      type: 'snapshot',
      sessionId: this.sessionId(),
      snapshot: this.snapshots[this.index],
      depth: HISTORY_DEPTH,
    });
  }

  private send(message: ExtensionMessage): void {
    if (this.listener !== null) {
      deliver(message, this.listener);
    }
  }

  private sessionId(): string {
    return `demo-${this.run}`;
  }

  private changed(): void {
    this.state = this.capture();
    this.watchers.forEach((watcher) => watcher());
  }

  private capture(): PlayerState {
    return {
      pause: this.index + 1,
      total: this.snapshots.length,
      finished: this.finished,
      line: this.finished ? null : (this.snapshots[this.index].frames[0]?.line ?? null),
    };
  }
}
