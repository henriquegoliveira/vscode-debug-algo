import * as vscode from 'vscode';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { webviewContentSecurityPolicy } from './contentSecurityPolicy';

const VIEW_TYPE = 'dbgAlgoWebview';
const PANEL_TITLE = 'DbgAlgo Visualizer';

const MEDIA_DIRECTORY = 'media';
const ASSETS_DIRECTORY = 'assets';
const HTML_FILE = 'index.html';
const BUNDLE_FILE = 'bundle.js';
const ICON_SET = 'tree';
const ICON_LIGHT_FILE = `icon-${ICON_SET}-light.svg`;
const ICON_DARK_FILE = `icon-${ICON_SET}-dark.svg`;

const CSP_PLACEHOLDER = '%CSP%';
const NONCE_PLACEHOLDER = '%NONCE%';
const BUNDLE_PLACEHOLDER = '%BUNDLE%';

const NONCE_BYTES = 16;

export const MISSING_BUNDLE_MESSAGE =
  'DbgAlgo não encontrou os arquivos da interface e não pode abrir o Visualizer. ' +
  'Construa o bundle da interface, se estiver rodando pelo código-fonte, ou reinstale a extensão.';

export class VisualizerPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly panelDisposables: vscode.Disposable[] = [];
  private readonly messageEmitter = new vscode.EventEmitter<unknown>();
  public readonly onDidReceiveMessage: vscode.Event<unknown> = this.messageEmitter.event;
  private readonly mediaRoot: vscode.Uri;
  private readonly assetsRoot: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.mediaRoot = vscode.Uri.joinPath(extensionUri, MEDIA_DIRECTORY);
    this.assetsRoot = vscode.Uri.joinPath(extensionUri, ASSETS_DIRECTORY);
  }

  public show(): void {
    if (this.panel !== undefined) {
      this.panel.reveal();
      return;
    }

    const template = this.readTemplate();
    if (template === undefined) {
      void vscode.window.showErrorMessage(MISSING_BUNDLE_MESSAGE);
      return;
    }

    const panel = vscode.window.createWebviewPanel(VIEW_TYPE, PANEL_TITLE, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [this.mediaRoot],
    });
    this.panel = panel;

    panel.iconPath = {
      light: vscode.Uri.joinPath(this.assetsRoot, ICON_LIGHT_FILE),
      dark: vscode.Uri.joinPath(this.assetsRoot, ICON_DARK_FILE),
    };

    this.panelDisposables.push(
      panel.onDidDispose(() => this.clearPanel()),
      panel.webview.onDidReceiveMessage((message: unknown) => this.messageEmitter.fire(message)),
    );

    panel.webview.html = this.render(panel.webview, template);
  }

  public postMessage(message: unknown): void {
    void this.panel?.webview.postMessage(message);
  }

  public dispose(): void {
    this.panel?.dispose();
    this.clearPanel();
    this.messageEmitter.dispose();
  }

  private clearPanel(): void {
    this.panelDisposables.forEach((disposable) => disposable.dispose());
    this.panelDisposables.length = 0;
    this.panel = undefined;
  }

  private readTemplate(): string | undefined {
    try {
      return fs.readFileSync(vscode.Uri.joinPath(this.mediaRoot, HTML_FILE).fsPath, 'utf8');
    } catch {
      return undefined;
    }
  }

  private render(webview: vscode.Webview, template: string): string {
    const nonce = randomBytes(NONCE_BYTES).toString('base64');
    const bundleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.mediaRoot, BUNDLE_FILE));

    return template
      .replaceAll(CSP_PLACEHOLDER, webviewContentSecurityPolicy(webview, nonce))
      .replaceAll(NONCE_PLACEHOLDER, nonce)
      .replaceAll(BUNDLE_PLACEHOLDER, bundleUri.toString());
  }
}
