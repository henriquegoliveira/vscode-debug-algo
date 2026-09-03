import type { GraphSnapshot } from './graphSnapshot';

export const PROTOCOL_VERSION = 1;

export interface ReadyMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'ready';
  id?: string;
}

export interface SnapshotMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'snapshot';
  sessionId: string;
  snapshot: GraphSnapshot;
  depth: number;
  id?: string;
}

export interface HistoryMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'history';
  sessionId: string;
  entries: GraphSnapshot[];
  id?: string;
}

export interface SessionEndMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'sessionEnd';
  sessionId: string;
  id?: string;
}

export interface ErrorMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'error';
  sessionId: string | null;
  message: string;
  id?: string;
}

export interface ViewMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'view';
  file: string | null;
  state: unknown;
  id?: string;
}

export interface AnnotateMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'annotate';
  annotation: string;
  id?: string;
}

export interface SaveViewMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'saveView';
  file: string;
  state: unknown;
  id?: string;
}

export type WebviewMessage = ReadyMessage | AnnotateMessage | SaveViewMessage;

export type ExtensionMessage =
  SnapshotMessage | HistoryMessage | SessionEndMessage | ErrorMessage | ViewMessage;

interface Envelope {
  v: unknown;
  type: unknown;
  sessionId?: unknown;
  snapshot?: unknown;
  entries?: unknown;
  depth?: unknown;
  message?: unknown;
  annotation?: unknown;
  file?: unknown;
  state?: unknown;
  id?: unknown;
}

export function isWebviewMessage(value: unknown): value is WebviewMessage {
  const envelope = asEnvelope(value);
  if (envelope === undefined) {
    return false;
  }

  switch (envelope.type) {
    case 'ready':
      return true;
    case 'annotate':
      return typeof envelope.annotation === 'string' && envelope.annotation.length > 0;
    case 'saveView':
      return (
        typeof envelope.file === 'string' && envelope.file.length > 0 && isObject(envelope.state)
      );
    default:
      return false;
  }
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  const envelope = asEnvelope(value);
  if (envelope === undefined) {
    return false;
  }

  switch (envelope.type) {
    case 'snapshot':
      return (
        typeof envelope.sessionId === 'string' &&
        isObject(envelope.snapshot) &&
        typeof envelope.depth === 'number'
      );
    case 'history':
      return (
        typeof envelope.sessionId === 'string' &&
        Array.isArray(envelope.entries) &&
        envelope.entries.every((entry) => isObject(entry))
      );
    case 'sessionEnd':
      return typeof envelope.sessionId === 'string';
    case 'error':
      return (
        (typeof envelope.sessionId === 'string' || envelope.sessionId === null) &&
        typeof envelope.message === 'string'
      );
    case 'view':
      return (
        (typeof envelope.file === 'string' || envelope.file === null) &&
        (isObject(envelope.state) || envelope.state === null || envelope.state === undefined)
      );
    default:
      return false;
  }
}

function asEnvelope(value: unknown): Envelope | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const candidate = value as Envelope;
  if (candidate.v !== PROTOCOL_VERSION || typeof candidate.type !== 'string') {
    return undefined;
  }
  if (candidate.id !== undefined && typeof candidate.id !== 'string') {
    return undefined;
  }

  return candidate;
}

function isObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}
