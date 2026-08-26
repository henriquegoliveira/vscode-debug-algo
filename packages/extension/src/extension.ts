import * as vscode from 'vscode';
import * as path from 'path';
import { DebugSessionManager } from './debugSessionManager';
import { ExtractorInvoker } from './extractorInvoker';
import { SnapshotReader } from './snapshotReader';
import { warnIfNoSupportedDebugSession } from './debuggerAvailability';
import { appendDynamicArray } from './extractionSettings';
import { VisualizerPanel } from './visualizerPanel';
import { SnapshotBroker } from './snapshotBroker';
import { WebviewChannel } from './webviewChannel';

export class ExtensionController {
  private sessionManager: DebugSessionManager;
  private invoker: ExtractorInvoker;
  private reader: SnapshotReader;
  private panel: VisualizerPanel;
  private broker: SnapshotBroker;

  constructor(private context: vscode.ExtensionContext) {
    const schemaPath = path.join(context.extensionPath, 'schemas', 'graph-snapshot.schema.json');
    this.reader = new SnapshotReader(schemaPath);
    this.invoker = new ExtractorInvoker(this.context.extensionPath, this.reader);
    this.panel = new VisualizerPanel(context.extensionUri);

    this.broker = new SnapshotBroker();
    this.broker.register(new WebviewChannel(this.panel, (channel) => this.broker.replay(channel)));

    this.sessionManager = new DebugSessionManager(
      this.invoker,
      context.globalState,
      (snapshot, session) => this.broker.publish(snapshot, session),
      (message, session) => this.broker.publishError(message, session),
    );
  }

  public activate(): void {
    console.log('Extensão DbgAlgo ativada com sucesso!');

    this.context.subscriptions.push(this.sessionManager, this.panel, this.broker);

    this.context.subscriptions.push(
      vscode.debug.onDidTerminateDebugSession((session) => this.broker.publishSessionEnd(session)),
      vscode.commands.registerCommand('dbg-algo.start', () => this.startVisualizerCommand()),
      vscode.commands.registerCommand('dbg-algo.annotateArray', () => this.annotateArrayCommand()),
    );
  }

  public deactivate(): void {}

  private async annotateArrayCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const selected = editor?.document.getText(editor.selection).trim() ?? '';

    const typed = await vscode.window.showInputBox({
      value: selected.length > 0 ? `${selected}@` : '',
      valueSelection: [selected.length + 1, selected.length + 1],
    });
    if (typed === undefined) {
      return;
    }

    const annotation = typed.trim();
    if (annotation.length === 0) {
      return;
    }

    await appendDynamicArray(annotation);
  }

  private startVisualizerCommand(): void {
    warnIfNoSupportedDebugSession(this.sessionManager);
    this.panel.show();
  }
}

let controller: ExtensionController | undefined;

export function activate(context: vscode.ExtensionContext) {
  controller = new ExtensionController(context);
  controller.activate();
}

export function deactivate() {
  if (controller) {
    controller.deactivate();
  }
}
