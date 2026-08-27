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

export interface AnnotateMessage {
  v: typeof PROTOCOL_VERSION;
  type: 'annotate';
  annotation: string;
  id?: string;
}

export type WebviewMessage = ReadyMessage | AnnotateMessage;

export type ExtensionMessage = SnapshotMessage | SessionEndMessage | ErrorMessage;

interface Envelope {
  v: unknown;
  type: unknown;
  sessionId?: unknown;
  snapshot?: unknown;
  message?: unknown;
  annotation?: unknown;
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
      return typeof envelope.sessionId === 'string' && isObject(envelope.snapshot);
    case 'sessionEnd':
      return typeof envelope.sessionId === 'string';
    case 'error':
      return (
        (typeof envelope.sessionId === 'string' || envelope.sessionId === null) &&
        typeof envelope.message === 'string'
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
