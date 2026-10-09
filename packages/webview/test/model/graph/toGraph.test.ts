import { describe, expect, it } from 'vitest';
import { rootFollowers, toGraph } from '../../../src/model/graph/toGraph';
import { DEFAULT_OPTIONS } from '../../../src/model/graph/types';
import { FALLBACK_THEME } from '../../../src/ui/theme';
import {
  binarySearchTreeSnapshot,
  classReferenceSnapshot,
  linkedListCyclicSnapshot,
  linkedListDoubleSnapshot,
} from '../../snapshots';

const ids = (model: ReturnType<typeof toGraph>, kind?: string): string[] =>
  model.canvas.nodes
    .filter((node) => kind === undefined || node.kind === kind)
    .map((node) => node.id);

describe('toGraph', () => {
  it('draws one canvas node per extracted address', () => {
    const snapshot = binarySearchTreeSnapshot();
    const model = toGraph(snapshot);
    const drawn = ids(model, 'record');

    expect(new Set(drawn).size).toBe(drawn.length);
    expect(drawn.sort()).toEqual(snapshot.nodes.map((node) => `n:${node.id}`).sort());
  });

  it('labels every non-null edge with its field and leaves NULL out by default', () => {
    const snapshot = binarySearchTreeSnapshot();
    const model = toGraph(snapshot);
    const pointers = snapshot.edges.filter((edge) => edge.to !== null);

    expect(model.canvas.edges.filter((edge) => edge.id.startsWith('e:'))).toHaveLength(
      pointers.length,
    );
    pointers.forEach((edge) => {
      const drawn = model.canvas.edges.find(
        (candidate) => candidate.id === `e:${edge.from}:${edge.field}`,
      );

      expect(drawn?.label).toBe(edge.field);
      expect(drawn?.to).toBe(`n:${edge.to}`);
    });
    expect(ids(model, 'null')).toEqual([]);
  });

  it('adds one NULL terminal per node with null pointers when asked', () => {
    const snapshot = binarySearchTreeSnapshot();
    const model = toGraph(snapshot, FALLBACK_THEME, { ...DEFAULT_OPTIONS, nullTerminals: true });
    const withNull = new Set(
      snapshot.edges.filter((edge) => edge.to === null).map((edge) => edge.from),
    );

    expect(ids(model, 'null').sort()).toEqual([...withNull].map((id) => `t:${id}`).sort());
  });

  it('gives every NULL terminal a seat in the tree layout', () => {
    const model = toGraph(binarySearchTreeSnapshot(), FALLBACK_THEME, {
      ...DEFAULT_OPTIONS,
      nullTerminals: true,
    });

    model.canvas.nodes
      .filter((node) => node.kind === 'null')
      .forEach((node) => {
        expect(Number.isFinite(node.x)).toBe(true);
        expect(Number.isFinite(node.y)).toBe(true);
      });
  });

  it('terminates on a cyclic list and draws the cycle as plain edges', () => {
    const snapshot = linkedListCyclicSnapshot();
    const model = toGraph(snapshot);

    expect(ids(model).filter((id) => id.startsWith('n:'))).toHaveLength(snapshot.nodes.length);
    expect(ids(model, 'opaque')).toEqual(['n:0x1']);
    expect(model.canvas.edges.filter((edge) => edge.id.startsWith('e:'))).toHaveLength(3);
  });

  it('curves the two directions of a doubly linked pair apart', () => {
    const model = toGraph(linkedListDoubleSnapshot());
    const curved = model.canvas.edges.filter((edge) => edge.smooth?.enabled === true);

    expect(curved.length).toBeGreaterThan(0);
    curved.forEach((edge) => {
      expect(
        model.canvas.edges.some((other) => other.from === edge.to && other.to === edge.from),
      ).toBe(true);
    });
  });

  it('gathers roots that point at the same node into one card', () => {
    const snapshot = classReferenceSnapshot();
    const model = toGraph(snapshot);
    const head = snapshot.roots.find((root) => root.name === 'ptHead')?.node as string;
    const card = model.cards.find((candidate) => candidate.node === head);

    expect(card).toBeDefined();
    expect(card?.roots.length).toBeGreaterThan(1);
    expect(new Set(model.cards.map((candidate) => candidate.node)).size).toBe(model.cards.length);
    expect(rootFollowers(model).get(`n:${head}`)).toEqual([card?.id]);
  });

  it('groups the roots by frame, from the innermost outwards', () => {
    const model = toGraph(binarySearchTreeSnapshot());

    expect(model.frames.map((frame) => frame.function)).toEqual([
      'searchForParent',
      'removal',
      'main',
    ]);
    expect(model.frames.every((frame) => frame.roots.length > 0)).toBe(true);
  });

  it('hides the nodes owned only by frames left out of the filter', () => {
    const snapshot = binarySearchTreeSnapshot();
    const all = toGraph(snapshot);
    const filtered = toGraph(snapshot, FALLBACK_THEME, {
      ...DEFAULT_OPTIONS,
      frames: new Set(['main#2']),
    });

    expect(filtered.frames.find((frame) => frame.function === 'removal')?.enabled).toBe(false);
    expect(ids(filtered, 'record').length).toBeLessThanOrEqual(ids(all, 'record').length);
  });
});
