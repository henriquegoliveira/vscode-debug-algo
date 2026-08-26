import {
  ExtensionMessage,
  PROTOCOL_VERSION,
  WebviewMessage,
  isExtensionMessage,
} from 'dbga-contract';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscodeApi = acquireVsCodeApi();

export function connectSnapshotChannel(): void {
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isExtensionMessage(event.data)) {
      return;
    }
    report(event.data);
  });

  const ready: WebviewMessage = { v: PROTOCOL_VERSION, type: 'ready' };
  vscodeApi.postMessage(ready);
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
