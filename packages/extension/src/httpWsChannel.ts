import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import type { Duplex } from 'stream';
import { randomBytes, timingSafeEqual } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { ExtensionMessage, isWebviewMessage } from 'dbga-contract';
import { SnapshotChannel } from './snapshotBroker';
import { httpContentSecurityPolicy } from './contentSecurityPolicy';

const MEDIA_DIRECTORY = 'media';
const HTML_FILE = 'index.html';
const BUNDLE_FILE = 'bundle.js';
const BUNDLE_ROUTE = '/bundle.js';

const CSP_PLACEHOLDER = '%CSP%';
const NONCE_PLACEHOLDER = '%NONCE%';
const BUNDLE_PLACEHOLDER = '%BUNDLE%';

const NONCE_BYTES = 16;
const TOKEN_BYTES = 24;
const TOKEN_PARAMETER = 'token';

const HOST = '127.0.0.1';

const UNAUTHORIZED = 401;
const INTERNAL_ERROR = 500;

export class HttpWsChannel implements SnapshotChannel {
  private readonly mediaRoot: string;
  private readonly token = randomBytes(TOKEN_BYTES).toString('hex');
  private readonly sockets = new Set<WebSocket>();
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private server: http.Server | undefined;

  constructor(
    extensionPath: string,
    private readonly onReady: (channel: SnapshotChannel) => void,
  ) {
    this.mediaRoot = path.resolve(extensionPath, MEDIA_DIRECTORY);
  }

  public listen(): Promise<void> {
    if (this.readTemplate() === undefined) {
      return Promise.reject(new MissingBundleError());
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer(this.createApplication());
      this.server = server;

      server.on('error', reject);
      server.on('upgrade', (request, socket, head) => this.upgrade(request, socket, head));
      server.listen(0, HOST, () => resolve());
    });
  }

  public get address(): string {
    return `http://${HOST}:${this.port}/?${TOKEN_PARAMETER}=${this.token}`;
  }

  public post(message: ExtensionMessage): void {
    const payload = JSON.stringify(message);

    this.sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    });
  }

  public dispose(): void {
    this.sockets.forEach((socket) => socket.close());
    this.sockets.clear();
    this.webSocketServer.close();
    this.server?.close();
    this.server = undefined;
  }

  private get port(): number {
    const address = this.server?.address();

    return typeof address === 'object' && address !== null ? address.port : 0;
  }

  private createApplication(): express.Express {
    const application = express();

    application.use((request: Request, response: Response, next: NextFunction) =>
      this.authorize(request, response, next),
    );
    application.get('/', (request: Request, response: Response) => this.page(request, response));
    application.get(BUNDLE_ROUTE, (_request: Request, response: Response) =>
      response.sendFile(path.join(this.mediaRoot, BUNDLE_FILE)),
    );

    return application;
  }

  private authorize(request: Request, response: Response, next: NextFunction): void {
    if (!this.isAuthorized(request.query[TOKEN_PARAMETER])) {
      response.sendStatus(UNAUTHORIZED);
      return;
    }

    next();
  }

  private isAuthorized(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const provided = Buffer.from(value, 'utf8');
    const expected = Buffer.from(this.token, 'utf8');

    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }

  private page(request: Request, response: Response): void {
    const template = this.readTemplate();
    if (template === undefined) {
      response.sendStatus(INTERNAL_ERROR);
      return;
    }

    const nonce = randomBytes(NONCE_BYTES).toString('base64');
    const host = request.get('host') ?? `${HOST}:${this.port}`;
    const bundle = `${BUNDLE_ROUTE}?${TOKEN_PARAMETER}=${this.token}`;

    response
      .type('html')
      .send(
        template
          .replaceAll(CSP_PLACEHOLDER, httpContentSecurityPolicy(nonce, host))
          .replaceAll(NONCE_PLACEHOLDER, nonce)
          .replaceAll(BUNDLE_PLACEHOLDER, bundle),
      );
  }

  private upgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    const requested = new URL(request.url ?? '/', `http://${HOST}`);

    if (!this.isAuthorized(requested.searchParams.get(TOKEN_PARAMETER))) {
      socket.write(`HTTP/1.1 ${UNAUTHORIZED} Unauthorized\r\n\r\n`);
      socket.destroy();
      return;
    }

    this.webSocketServer.handleUpgrade(request, socket, head, (accepted) => this.accept(accepted));
  }

  private accept(socket: WebSocket): void {
    this.sockets.add(socket);

    socket.on('close', () => this.sockets.delete(socket));
    socket.on('message', (data: unknown) => {
      const message = parse(String(data));
      if (isWebviewMessage(message) && message.type === 'ready') {
        this.onReady(single(socket));
      }
    });
  }

  private readTemplate(): string | undefined {
    try {
      return fs.readFileSync(path.join(this.mediaRoot, HTML_FILE), 'utf8');
    } catch {
      return undefined;
    }
  }
}

export class MissingBundleError extends Error {}

function single(socket: WebSocket): SnapshotChannel {
  return {
    post: (message: ExtensionMessage) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    dispose: () => {},
  };
}

function parse(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}
