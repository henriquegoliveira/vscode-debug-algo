import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SnapshotReader } from '../../../src/debug/snapshotReader';

const ROOT = path.resolve(__dirname, '../../../../..');
const SCHEMA = path.join(ROOT, 'packages/extension/schemas/graph-snapshot.schema.json');
const FIXTURES = path.join(ROOT, 'tests/fixtures');

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

describe('SnapshotReader', () => {
  let folder: string;
  const reader = new SnapshotReader(SCHEMA);

  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), 'dbga-reader-'));
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  const written = (name: string, content: string): string => {
    const file = path.join(folder, name);
    writeFileSync(file, content);
    return file;
  };

  it('accepts real snapshots from both languages', () => {
    ['binary_search_tree', 'linked_list_cyclic', 'class_reference', 'sorting_merge.0'].forEach(
      (name) => expect(reader.validate(fixture(name))).toBe(true),
    );
  });

  it('reads and returns a valid snapshot from disk', async () => {
    const snapshot = fixture('linked_list_cyclic');
    const read = await reader.read(written('ok.json', JSON.stringify(snapshot)));

    expect(read).toEqual(snapshot);
  });

  it('rejects a snapshot from another contract version', async () => {
    const snapshot = fixture('linked_list_cyclic');
    (snapshot.meta as Record<string, unknown>).version = 3;
    const file = written('v3.json', JSON.stringify(snapshot));

    await expect(reader.read(file)).rejects.toThrow(file);
  });

  it('rejects a node without its kind', () => {
    const snapshot = fixture('binary_search_tree');
    delete (snapshot.nodes as Record<string, unknown>[])[0].kind;

    expect(reader.validate(snapshot)).toBe(false);
  });

  it('rejects a scalar value with an unknown tag', () => {
    const snapshot = fixture('linked_list_cyclic');
    const roots = snapshot.roots as Record<string, unknown>[];
    roots[1].value = { t: 'float', v: 1 };

    expect(reader.validate(snapshot)).toBe(false);
  });

  it('gives up on a file that never appears, naming the path', async () => {
    const missing = path.join(folder, 'missing.json');

    await expect(reader.read(missing)).rejects.toThrow(missing);
  });

  it('retries a half-written file until it parses', async () => {
    const file = written('late.json', '{"meta":');
    setTimeout(() => writeFileSync(file, JSON.stringify(fixture('linked_list_cyclic'))), 15);

    await expect(reader.read(file)).resolves.toMatchObject({ meta: { version: 2 } });
  });
});
