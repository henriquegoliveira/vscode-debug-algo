import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import {
  httpContentSecurityPolicy,
  webviewContentSecurityPolicy,
} from '../../../src/channels/contentSecurityPolicy';

const directives = (policy: string): Map<string, string> =>
  new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources.join(' ')];
    }),
  );

describe('webviewContentSecurityPolicy', () => {
  const webview = { cspSource: 'https://file+.vscode-resource.vscode-cdn.net' } as vscode.Webview;
  const policy = directives(webviewContentSecurityPolicy(webview, 'abc123'));

  it('blocks every network connection from the panel', () => {
    expect(policy.get('connect-src')).toBe("'none'");
    expect(policy.get('default-src')).toBe("'none'");
  });

  it('runs only the script with the nonce', () => {
    expect(policy.get('script-src')).toBe("'nonce-abc123'");
  });

  it('loads styles and images only from the webview resource origin', () => {
    expect(policy.get('img-src')).toBe(`${webview.cspSource} data:`);
    expect(policy.get('style-src')).toContain(webview.cspSource);
  });
});

describe('httpContentSecurityPolicy', () => {
  it('allows the WebSocket of the serving host only', () => {
    const policy = directives(httpContentSecurityPolicy('n0nce', '127.0.0.1:40123'));

    expect(policy.get('connect-src')).toBe('ws://127.0.0.1:40123 wss://127.0.0.1:40123');
    expect(policy.get('script-src')).toBe("'nonce-n0nce'");
    expect(policy.get('default-src')).toBe("'none'");
  });
});
