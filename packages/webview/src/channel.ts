import {
  ExtensionMessage,
  PROTOCOL_VERSION,
  WebviewMessage,
  isExtensionMessage,
} from 'dbga-contract';

declare function acquireVsCodeApi(): VsCodeApi;

export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

const TOKEN_PARAMETER = 'token';

let acquired: VsCodeApi | undefined;

export type SnapshotListener = (message: ExtensionMessage) => void;

export function isEmbedded(): boolean {
  return typeof acquireVsCodeApi === 'function';
}

export function hostApi(): VsCodeApi | undefined {
  if (!isEmbedded()) {
    return undefined;
  }

  if (acquired === undefined) {
    acquired = acquireVsCodeApi();
  }

  return acquired;
}

export function sendAnnotation(annotation: string): boolean {
  const api = hostApi();
  if (api === undefined) {
    return false;
  }

  const message: WebviewMessage = { v: PROTOCOL_VERSION, type: 'annotate', annotation };
  api.postMessage(message);

  return true;
}

export function connectSnapshotChannel(onMessage: SnapshotListener): () => void {
  if (isEmbedded()) {
    return connectOverVsCode(onMessage);
  }

  return connectOverWebSocket(onMessage);
}

function connectOverVsCode(onMessage: SnapshotListener): () => void {
  const api = hostApi() as VsCodeApi;

  const listener = (event: MessageEvent<unknown>): void => {
    deliver(event.data, onMessage);
  };

  window.addEventListener('message', listener);
  api.postMessage(ready());

  return () => window.removeEventListener('message', listener);
}

function connectOverWebSocket(onMessage: SnapshotListener): () => void {
  const socket = new WebSocket(webSocketUrl());

  socket.addEventListener('message', (event: MessageEvent<string>) => {
    deliver(parse(event.data), onMessage);
  });

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify(ready()));
  });

  socket.addEventListener('close', () => {
    console.log('[DbgAlgo] conexao encerrada pelo servidor');
  });

  socket.addEventListener('error', () => {
    console.log('[DbgAlgo] falha na conexao com o servidor');
  });

  return () => socket.close();
}

function webSocketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = new URLSearchParams(window.location.search).get(TOKEN_PARAMETER) ?? '';

  return `${scheme}//${window.location.host}/?${TOKEN_PARAMETER}=${encodeURIComponent(token)}`;
}

function ready(): WebviewMessage {
  return { v: PROTOCOL_VERSION, type: 'ready' };
}

function parse(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function deliver(payload: unknown, onMessage: SnapshotListener): void {
  if (!isExtensionMessage(payload)) {
    return;
  }

  onMessage(payload);
}
