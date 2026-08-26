import {
  ExtensionMessage,
  PROTOCOL_VERSION,
  WebviewMessage,
  isExtensionMessage,
} from 'dbga-contract';

declare function acquireVsCodeApi(): VsCodeApi;

interface VsCodeApi {
  postMessage(message: unknown): void;
}

const TOKEN_PARAMETER = 'token';

let vsCodeApi: VsCodeApi | undefined;

export type SnapshotListener = (message: ExtensionMessage) => void;

export function connectSnapshotChannel(onMessage: SnapshotListener): () => void {
  if (typeof acquireVsCodeApi === 'function') {
    return connectOverVsCode(onMessage);
  }

  return connectOverWebSocket(onMessage);
}

function connectOverVsCode(onMessage: SnapshotListener): () => void {
  if (vsCodeApi === undefined) {
    vsCodeApi = acquireVsCodeApi();
  }

  const listener = (event: MessageEvent<unknown>): void => {
    deliver(event.data, onMessage);
  };

  window.addEventListener('message', listener);
  vsCodeApi.postMessage(ready());

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
