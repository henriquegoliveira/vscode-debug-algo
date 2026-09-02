import * as vscode from 'vscode';

export function webviewContentSecurityPolicy(webview: vscode.Webview, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    "connect-src 'none'",
  ].join('; ');
}

export function httpContentSecurityPolicy(nonce: string, host: string): string {
  return [
    "default-src 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
    `connect-src ws://${host} wss://${host}`,
  ].join('; ');
}
