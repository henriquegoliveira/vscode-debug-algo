import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { WebSocket } from 'ws';
import type { GraphSnapshot, SnapshotMessage } from 'dbga-contract';
import { HttpWsChannel } from '../../src/channels/httpWsChannel';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const OUTPUT = path.join(ROOT, 'tests', 'output');
const SYNTHETIC_SIZES = [250, 500, 1000, 2000];
const EDGES_PER_NODE = 3;
const MAX_EDGES = 6000;

const read = (file: string): GraphSnapshot =>
  JSON.parse(readFileSync(file, 'utf8')) as GraphSnapshot;

const address = (index: number): string => `0x${(0x10000 + index * 0x20).toString(16)}`;

const synthetic = (size: number): GraphSnapshot => {
  const template = read(path.join(FIXTURES, 'binary_search_tree.json'));
  const edgeCount = Math.min(size * EDGES_PER_NODE, MAX_EDGES);

  return {
    meta: {
      ...template.meta,
      observedTypes: [
        {
          type: 'Node',
          pointerFields: ['a', 'b', 'c'],
          scalarFields: ['key'],
          count: size,
          maxDegree: EDGES_PER_NODE,
        },
      ],
    },
    frames: template.frames,
    roots: [
      {
        name: 'head',
        function: 'main',
        frameLevel: 0,
        origin: 'local',
        type: 'Node *',
        category: 'pointer',
        address: '0x7fffffffc000',
        target: address(0),
        indirections: 1,
        node: address(0),
        status: 'ok',
      },
    ],
    nodes: Array.from({ length: size }, (unused, index) => ({
      kind: 'record',
      id: address(index),
      type: 'Node',
      aggregate: 'struct',
      sizeBytes: 32,
      fields: [{ name: 'key', type: 'int', value: { t: 'int', v: index, signed: true } }],
      arrays: [],
    })),
    edges: Array.from({ length: edgeCount }, (unused, index) => {
      const from = Math.floor(index / EDGES_PER_NODE);
      const step = (index % EDGES_PER_NODE) + 1;
      return {
        from: address(from),
        field: ['a', 'b', 'c'][index % EDGES_PER_NODE],
        to: address((from + step) % size),
        type: 'Node *',
      };
    }),
  };
};

const largestOutput = (): [string, GraphSnapshot][] => {
  if (!existsSync(OUTPUT)) return [];
  const files = readdirSync(OUTPUT)
    .filter((name) => name.endsWith('.gdb.json'))
    .map((name) => path.join(OUTPUT, name))
    .sort((left, right) => statSync(right).size - statSync(left).size);

  return files.length > 0 ? [[path.basename(files[0], '.gdb.json'), read(files[0])]] : [];
};

const loads: [string, GraphSnapshot][] = [
  ...readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name): [string, GraphSnapshot] => [
      path.basename(name, '.json'),
      read(path.join(FIXTURES, name)),
    ]),
  ...largestOutput(),
  ...SYNTHETIC_SIZES.map((size): [string, GraphSnapshot] => [`synthetic-${size}`, synthetic(size)]),
];

const envelope = (snapshot: GraphSnapshot): SnapshotMessage => ({
  v: 1,
  type: 'snapshot',
  sessionId: 'session',
  snapshot,
  depth: 20,
});

let extensionPath: string;
let channel: HttpWsChannel;
let client: WebSocket;

beforeAll(async () => {
  extensionPath = mkdtempSync(path.join(tmpdir(), 'dbga-bench-'));
  mkdirSync(path.join(extensionPath, 'media'));
  writeFileSync(path.join(extensionPath, 'media', 'index.html'), '%CSP%%NONCE%%BUNDLE%');
  writeFileSync(path.join(extensionPath, 'media', 'bundle.js'), '');
  channel = new HttpWsChannel(extensionPath, () => {});
  await channel.listen();

  const url = new URL(channel.address);
  url.protocol = 'ws:';
  client = await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url.toString());
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
});

afterAll(() => {
  client.close();
  channel.dispose();
  rmSync(extensionPath, { recursive: true, force: true });
});

const delivered = (message: SnapshotMessage): Promise<void> =>
  new Promise((resolve) => {
    client.once('message', () => resolve());
    channel.post(message);
  });

describe('transport', () => {
  for (const [name, snapshot] of loads) {
    const message = envelope(snapshot);
    const payload = JSON.stringify(message);

    test(`${name} | ${Buffer.byteLength(payload)}`, async ({ bench }) => {
      await bench.compare(
        bench('serialize', () => {
          JSON.stringify(message);
        }),
        bench('deliver', async () => {
          await delivered(message);
        }),
        bench('parse', () => {
          JSON.parse(payload);
        }),
      );
    });
  }
});
