import {
  ExtensionMessage,
  PROTOCOL_VERSION,
  WebviewMessage,
  isExtensionMessage,
} from 'dbga-contract';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const TOKEN_PARAMETER = 'token';

export function connectSnapshotChannel(): void {
  if (typeof acquireVsCodeApi === 'function') {
    connectOverVsCode();
    return;
  }

  connectOverWebSocket();
}

function connectOverVsCode(): void {
  const vscodeApi = acquireVsCodeApi();

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    deliver(event.data);
  });

  vscodeApi.postMessage(ready());
}

function connectOverWebSocket(): void {
  const socket = new WebSocket(webSocketUrl());

  socket.addEventListener('message', (event: MessageEvent<string>) => {
    deliver(parse(event.data));
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

function deliver(payload: unknown): void {
  if (!isExtensionMessage(payload)) {
    return;
  }

  report(payload);
}

function report(message: ExtensionMessage): void {
  if (message.type === 'snapshot') {
    const { roots, nodes, edges } = message.snapshot;
    console.log(
      `[DbgAlgo] snapshot sessao=${message.sessionId} roots=${roots.length} nodes=${nodes.length} edges=${edges.length}`,
    );
    return;
  }

  if (message.type === 'error') {
    console.log(`[DbgAlgo] error sessao=${message.sessionId}: ${message.message}`);
    return;
  }

  console.log(`[DbgAlgo] sessionEnd sessao=${message.sessionId}`);
}
