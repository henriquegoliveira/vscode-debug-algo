import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { firstDifference, normalize, normalizeSequence } from './normalize.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const fixture = (name) => JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

const relocated = (snapshot, offset) =>
  JSON.parse(
    JSON.stringify(snapshot, (_key, value) =>
      typeof value === 'string' && /^0x[0-9a-f]+$/.test(value)
        ? `0x${(BigInt(value) + offset).toString(16)}`
        : value,
    ),
  );

const shuffled = (snapshot) => ({
  ...snapshot,
  roots: [...snapshot.roots].reverse(),
  nodes: [...snapshot.nodes].reverse(),
  edges: [...snapshot.edges].reverse(),
  frames: [...snapshot.frames].reverse(),
});

describe('normalize', () => {
  it('gives the same result when the program runs at other addresses', () => {
    ['binary_search_tree', 'linked_list_cyclic', 'class_reference'].forEach((name) => {
      const snapshot = fixture(name);

      expect(normalize(relocated(snapshot, 0x1000n))).toEqual(normalize(snapshot));
    });
  });

  it('gives the same result whatever order the extractor listed things in', () => {
    const snapshot = fixture('binary_search_tree');

    expect(normalize(shuffled(snapshot))).toEqual(normalize(snapshot));
  });

  it('replaces every address with a canonical label', () => {
    const text = JSON.stringify(normalize(fixture('linked_list_double_linear_head')));

    expect(text).not.toMatch(/"0x[0-9a-f]+"/);
    expect(text).toMatch(/"#0"/);
  });

  it('clears the fields that change between runs and debuggers', () => {
    const { meta } = normalize(fixture('linked_list_cyclic'));

    expect(meta).toMatchObject({
      debugger: '',
      debuggerVersion: '',
      generatedAt: 0,
      framesSkipped: 0,
    });
    expect(meta.version).toBe(2);
  });

  it('still tells apart two graphs with different shapes', () => {
    const snapshot = fixture('binary_search_tree');
    const pruned = { ...snapshot, edges: snapshot.edges.slice(1) };

    expect(normalize(pruned)).not.toEqual(normalize(snapshot));
  });
});

describe('normalizeSequence', () => {
  it('keeps the label of an address across pauses', () => {
    const [first, second] = normalizeSequence([
      fixture('sorting_merge.0'),
      fixture('sorting_merge.1'),
    ]);
    const label = (snapshot, name) =>
      snapshot.roots.find((root) => root.name === name && root.frameLevel === 0).node;

    expect(label(first, 'list')).toBe(label(second, 'list'));
    expect(label(first, 'lTmp')).toBe(label(second, 'lTmp'));
  });
});

describe('firstDifference', () => {
  it('returns null for equal values and the path of the first difference otherwise', () => {
    const left = { nodes: [{ id: '#0', fields: [1, 2] }] };

    expect(firstDifference(left, structuredClone(left))).toBeNull();
    expect(firstDifference(left, { nodes: [{ id: '#0', fields: [1, 3] }] })).toEqual({
      path: '.nodes[0].fields[1]',
      left: 2,
      right: 3,
    });
    expect(firstDifference(left, { nodes: [] })).toMatchObject({ path: '.nodes.length' });
  });
});
