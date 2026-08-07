import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DebugSessionManager } from './debugSessionManager';
import { ExtractorInvoker } from './extractorInvoker';
import { SnapshotReader } from './snapshotReader';
import { warnIfNoSupportedDebugSession } from './debuggerAvailability';

export class ExtensionController {
  private sessionManager: DebugSessionManager;
  private invoker: ExtractorInvoker;
  private reader: SnapshotReader;

  constructor(private context: vscode.ExtensionContext) {
    const schemaPath = path.join(context.extensionPath, 'schemas', 'graph-snapshot.schema.json');
    this.reader = new SnapshotReader(schemaPath);
    this.invoker = new ExtractorInvoker(this.context.extensionPath, this.reader);

    // Provisório: TransportServer não implementado ainda
    this.sessionManager = new DebugSessionManager(this.invoker, (snapshot, session) => {
      console.log(`[DbgAlgo] snapshot da sessao ${session.id}:`, JSON.stringify(snapshot));
    });
  }

  public activate(): void {
    console.log('Extensão DbgAlgo ativada com sucesso!');

    // Registra os disposables no contexto
    this.context.subscriptions.push(this.sessionManager);

    // Registra o comando de inicialização
    const commandDisposable = vscode.commands.registerCommand('dbg-algo.start', () =>
      this.startWebViewCommand(),
    );
    this.context.subscriptions.push(commandDisposable);
  }

  public deactivate(): void {}

  private startWebViewCommand(): void {
    // Avisa ao usuário se não houver como extrair dados agora.
    warnIfNoSupportedDebugSession(this.sessionManager);

    // Cria a aba do Webview
    const panel = vscode.window.createWebviewPanel(
      'dbgAlgoWebview',
      'DbgAlgo Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, '../webview/dist')),
        ],
      },
    );

    // Configura o HTML
    panel.webview.html = this.getWebViewContent(panel.webview);
  }

  private getWebViewContent(webview: vscode.Webview): string {
    const webviewDistPath = path.join(this.context.extensionPath, '../webview/dist');
    const htmlPath = path.join(webviewDistPath, 'index.html');

    // Lê o HTML copiado para dist/ pelo plugin 'copy-html' do esbuild (packages/webview/esbuild.js)
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Pega o caminho do bundle.js e converte para um URI especial de segurança
    const scriptPathOnDisk = vscode.Uri.file(path.join(webviewDistPath, 'bundle.js'));
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    // Injeta a URI correta no HTML
    return html.replace('bundle.js', scriptUri.toString());
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
