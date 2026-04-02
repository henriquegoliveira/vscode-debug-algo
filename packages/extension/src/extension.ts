import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extensão DbgAlgo ativada com sucesso!');

    // Registra o comando exatamente como está no package.json
    let disposable = vscode.commands.registerCommand('dbg-algo.start', () => {
        // Cria a aba do Webview
        const panel = vscode.window.createWebviewPanel(
            'dbgAlgoWebview',
            'DbgAlgo Visualizer',
            vscode.ViewColumn.One,
            {
                enableScripts: true, // Permite rodar o React (JS)
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, '../webview/dist'))]
            }
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

export function deactivate() { }


