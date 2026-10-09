import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { ExtensionMessage } from 'dbga-contract';
import { HttpWsChannel, MissingBundleError } from '../../../src/channels/httpWsChannel';
import type { SnapshotChannel } from '../../../src/channels/snapshotBroker';

const TEMPLATE =
  '<meta http-equiv="Content-Security-Policy" content="%CSP%">' +
  '<script nonce="%NONCE%" src="%BUNDLE%"></script>';

const END: ExtensionMessage = { v: 1, type: 'sessionEnd', sessionId: 'session' };

describe('HttpWsChannel', () => {
  let extensionPath: string;
  let channel: HttpWsChannel | undefined;

  beforeEach(() => {
    extensionPath = mkdtempSync(path.join(tmpdir(), 'dbga-http-'));
  });

  afterEach(() => {
    channel?.dispose();
    channel = undefined;
    rmSync(extensionPath, { recursive: true, force: true });
  });

  const withBundle = (): void => {
    mkdirSync(path.join(extensionPath, 'media'));
    writeFileSync(path.join(extensionPath, 'media', 'index.html'), TEMPLATE);
    writeFileSync(path.join(extensionPath, 'media', 'bundle.js'), 'console.log(1);');
  };

  const started = async (onReady: (channel: SnapshotChannel) => void = () => {}) => {
    withBundle();
    channel = new HttpWsChannel(extensionPath, onReady);
    await channel.listen();
    const address = new URL(channel.address);

    return { address, token: address.searchParams.get('token') as string };
  };

  const socket = (url: string): Promise<WebSocket> =>
    new Promise((resolve, reject) => {
      const client = new WebSocket(url);
      client.once('open', () => resolve(client));
      client.once('error', reject);
    });

  const nextMessage = (client: WebSocket): Promise<unknown> =>
    new Promise((resolve) => client.once('message', (data) => resolve(JSON.parse(String(data)))));

  it('refuses to start without the interface bundle', async () => {
    channel = new HttpWsChannel(extensionPath, () => {});

    await expect(channel.listen()).rejects.toBeInstanceOf(MissingBundleError);
  });

  it('listens on the loopback address with a long random token', async () => {
    const { address, token } = await started();

    expect(address.hostname).toBe('127.0.0.1');
    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it('answers 401 without the token or with a wrong one', async () => {
    const { address, token } = await started();
    const base = `http://${address.host}`;
    const wrong = token.replace(/.$/, (last) => (last === '0' ? '1' : '0'));

    expect((await fetch(`${base}/`)).status).toBe(401);
    expect((await fetch(`${base}/?token=${wrong}`)).status).toBe(401);
    expect((await fetch(`${base}/?token=${token}x`)).status).toBe(401);
    expect((await fetch(`${base}/bundle.js`)).status).toBe(401);
  });

  it('serves the page with its CSP, nonce and bundle filled in', async () => {
    const { address } = await started();
    const page = await (await fetch(address)).text();

    expect(page).not.toMatch(/%CSP%|%NONCE%|%BUNDLE%/);
    expect(page).toContain(`connect-src ws://${address.host} wss://${address.host}`);
    expect(page).toContain(`src="/bundle.js?token=${address.searchParams.get('token')}"`);
  });

  it('draws a new nonce for every page', async () => {
    const { address } = await started();
    const nonce = async (): Promise<string> =>
      /nonce="([^"]+)"/.exec(await (await fetch(address)).text())?.[1] as string;

    expect(await nonce()).not.toBe(await nonce());
  });

  it('refuses a WebSocket upgrade without the token', async () => {
    const { address } = await started();

    await expect(socket(`ws://${address.host}/`)).rejects.toThrow(/401/);
  });

  it('hands each tab its own channel when it says ready', async () => {
    const onReady = vi.fn<(channel: SnapshotChannel) => void>();
    const { address, token } = await started(onReady);
    const first = await socket(`ws://${address.host}/?token=${token}`);
    const second = await socket(`ws://${address.host}/?token=${token}`);

    first.send(JSON.stringify({ v: 1, type: 'ready' }));
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));

    const firstGets = nextMessage(first);
    let secondGot = false;
    second.once('message', () => {
      secondGot = true;
    });
    onReady.mock.calls[0][0].post(END);

    expect(await firstGets).toEqual(END);
    expect(secondGot).toBe(false);

    first.close();
    second.close();
  });

  it('broadcasts to every open tab', async () => {
    const { address, token } = await started();
    const tabs = await Promise.all(
      [1, 2].map(() => socket(`ws://${address.host}/?token=${token}`)),
    );
    const received = Promise.all(tabs.map(nextMessage));

    channel?.post(END);

    expect(await received).toEqual([END, END]);
    tabs.forEach((tab) => tab.close());
  });

  it('ignores messages outside the protocol', async () => {
    const onReady = vi.fn();
    const { address, token } = await started(onReady);
    const tab = await socket(`ws://${address.host}/?token=${token}`);

    tab.send('not json');
    tab.send(JSON.stringify({ v: 2, type: 'ready' }));
    tab.send(JSON.stringify({ v: 1, type: 'ready' }));
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));

    tab.close();
  });
});
