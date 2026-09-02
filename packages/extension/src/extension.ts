import * as vscode from 'vscode';
import * as path from 'path';
import { DebugSessionManager } from './debugSessionManager';
import { ExtractorInvoker, sweepStaleTempFiles } from './extractorInvoker';
import { SnapshotReader } from './snapshotReader';
import { warnIfNoSupportedDebugSession } from './debuggerAvailability';
import {
  appendDynamicArray,
  readFileView,
  readHistoryDepth,
  saveFileView,
} from './extractionSettings';
import { MISSING_BUNDLE_MESSAGE, VisualizerPanel } from './visualizerPanel';
import { SnapshotBroker } from './snapshotBroker';
import { WebviewChannel } from './webviewChannel';
import { HttpWsChannel, MissingBundleError } from './httpWsChannel';

const SERVER_FAILED_MESSAGE =
  'DbgAlgo não conseguiu abrir o servidor local da Visualização. Tente de novo; se continuar ' +
  'falhando, algo no sistema está bloqueando conexões em 127.0.0.1.';

const OPEN_IN_BROWSER_ACTION = 'Abrir no navegador';

export class ExtensionController {
  private sessionManager: DebugSessionManager;
  private invoker: ExtractorInvoker;
  private reader: SnapshotReader;
  private panel: VisualizerPanel;
  private broker: SnapshotBroker;
  private httpChannel: HttpWsChannel | undefined;

  constructor(private context: vscode.ExtensionContext) {
    const schemaPath = path.join(context.extensionPath, 'schemas', 'graph-snapshot.schema.json');
    this.reader = new SnapshotReader(schemaPath);
    this.invoker = new ExtractorInvoker(this.context.extensionPath, this.reader);
    this.panel = new VisualizerPanel(context.extensionUri);

    this.broker = new SnapshotBroker(readFileView, readHistoryDepth);
    this.broker.register(
      new WebviewChannel(
        this.panel,
        (channel) => this.broker.replay(channel),
        (annotation) => void appendDynamicArray(annotation),
        (file, state) => saveFileView(file, state),
      ),
    );

    this.sessionManager = new DebugSessionManager(
      this.invoker,
      context.globalState,
      (snapshot, session, file) => this.broker.publish(snapshot, session, file),
      (message, session) => this.broker.publishError(message, session),
    );
  }

  public activate(): void {
    console.log('Extensão DbgAlgo ativada com sucesso!');

    void sweepStaleTempFiles();

    this.context.subscriptions.push(this.sessionManager, this.panel, this.broker);

    this.context.subscriptions.push(
      vscode.debug.onDidTerminateDebugSession((session) => this.broker.publishSessionEnd(session)),
      vscode.commands.registerCommand('dbg-algo.start', () => this.startVisualizerCommand()),
      vscode.commands.registerCommand('dbg-algo.annotateArray', () => this.annotateArrayCommand()),
      vscode.commands.registerCommand('dbg-algo.startServer', () => this.startServerCommand()),
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

  private async startServerCommand(): Promise<void> {
    if (this.httpChannel === undefined) {
      const channel = new HttpWsChannel(this.context.extensionPath, (target) =>
        this.broker.replay(target),
      );

      try {
        await channel.listen();
      } catch (error) {
        void vscode.window.showErrorMessage(
          error instanceof MissingBundleError ? MISSING_BUNDLE_MESSAGE : SERVER_FAILED_MESSAGE,
        );
        return;
      }

      this.httpChannel = channel;
      this.broker.register(channel);
    }

    warnIfNoSupportedDebugSession(this.sessionManager);

    const external = await vscode.env.asExternalUri(vscode.Uri.parse(this.httpChannel.address));
    const url = external.toString(true);

    await vscode.env.clipboard.writeText(url);

    const action = await vscode.window.showInformationMessage(
      serverReadyMessage(url),
      OPEN_IN_BROWSER_ACTION,
    );

    if (action === OPEN_IN_BROWSER_ACTION) {
      await vscode.env.openExternal(external);
    }
  }
}

function serverReadyMessage(url: string): string {
  return `Visualização disponível em ${url} — o link já está na área de transferência.`;
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
