import * as vscode from 'vscode';
import { ExtensionMessage, isWebviewMessage } from 'dbga-contract';
import { SnapshotChannel } from './snapshotBroker';
import { VisualizerPanel } from './visualizerPanel';

export class WebviewChannel implements SnapshotChannel {
  private readonly subscription: vscode.Disposable;

  constructor(
    private readonly panel: VisualizerPanel,
    onReady: (channel: SnapshotChannel) => void,
  ) {
    this.subscription = panel.onDidReceiveMessage((message) => {
      if (!isWebviewMessage(message)) {
        return;
      }
      if (message.type === 'ready') {
        onReady(this);
      }
    });
  }

  public post(message: ExtensionMessage): void {
    this.panel.postMessage(message);
  }

  public dispose(): void {
    this.subscription.dispose();
  }
}
