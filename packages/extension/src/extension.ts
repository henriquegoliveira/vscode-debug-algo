import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DebugSessionManager } from './debugSessionManager';
import { ExtractorInvoker } from './extractorInvoker';
import { SnapshotReader } from './snapshotReader';
import { warnIfNoSupportedDebugSession } from './debuggerAvailability';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extensão DbgAlgo ativada com sucesso!');

  const schemaPath = path.join(context.extensionPath, 'schemas', 'graph-snapshot.schema.json');
  const reader = new SnapshotReader(schemaPath);
  const invoker = new ExtractorInvoker(context.extensionPath, reader);

  // Provisório: TransportServer não implementado ainda
  const sessionManager = new DebugSessionManager(invoker, (snapshot, session) => {
    console.log(`[DbgAlgo] snapshot da sessao ${session.id}:`, JSON.stringify(snapshot));
  });
  context.subscriptions.push(sessionManager);

  // Registra o comando que está no package.json
  let disposable = vscode.commands.registerCommand('dbg-algo.start', () => {
    // Avisa ao usuário se não houver como extrair dados agora.
    // Não impede de abrir o painel.
    warnIfNoSupportedDebugSession(sessionManager);

    // Cria a aba do Webview
    const panel = vscode.window.createWebviewPanel(
      'dbgAlgoWebview',
      'DbgAlgo Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true, // Permite rodar o React (JS)
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, '../webview/dist'))],
      },
    );

    // Caminhos para a pasta dist do frontend
    const webviewDistPath = path.join(context.extensionPath, '../webview/dist');
    const htmlPath = path.join(webviewDistPath, 'index.html');

    // Lê o HTML gerado pelo HtmlWebpackPlugin
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Pega o caminho do bundle.js e converte para um URI especial de segurança do VS Code
    const scriptPathOnDisk = vscode.Uri.file(path.join(webviewDistPath, 'bundle.js'));
    const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

    // Injeta a URI correta no HTML (substitui o src="bundle.js" genérico)
    html = html.replace('bundle.js', scriptUri.toString());

    // Joga o HTML atualizado na tela
    panel.webview.html = html;
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
