import { describe, expect, it } from 'vitest';
import { BOX_GAP } from '../../src/geometry/boxes';
import {
  LEVEL_SEPARATION,
  backFields,
  byField,
  structuralForest,
  treePositions,
} from '../../src/geometry/treeLayout';
import {
  binarySearchTreeSnapshot,
  intValue,
  linkedListCyclicSnapshot,
  linkedListDoubleSnapshot,
  tree,
} from '../snapshots';

const lowHigh = (declared: string[]) =>
  tree(
    declared,
    [
      ['0x10', [intValue(50)]],
      ['0x20', [intValue(30)]],
      ['0x30', [intValue(70)]],
    ],
    [
      ['0x10', 'esq', '0x20'],
      ['0x10', 'dir', '0x30'],
    ],
  );

describe('byField', () => {
  it('orders by name and then by numeric index', () => {
    expect(['child[10]', 'child[2]', 'left', 'child'].sort(byField)).toEqual([
      'child',
      'child[2]',
      'child[10]',
      'left',
    ]);
  });
});

describe('backFields', () => {
  it('picks exactly one of the two directions of a doubly linked list', () => {
    expect(backFields(linkedListDoubleSnapshot()).size).toBe(1);
  });

  it('finds none in a tree', () => {
    expect(backFields(binarySearchTreeSnapshot()).size).toBe(0);
  });
});

describe('structuralForest', () => {
  it('roots a binary search tree at the node nobody points to', () => {
    const snapshot = binarySearchTreeSnapshot();
    const forest = structuralForest(snapshot);
    const root = snapshot.roots.find((candidate) => candidate.name === 'ptRoot')?.node;

    expect(forest.roots).toEqual([root]);
    expect(forest.depth.get(root as string)).toBe(0);
  });

  it('still covers every node of a cycle', () => {
    const snapshot = linkedListCyclicSnapshot();

    expect(structuralForest(snapshot).depth.size).toBe(snapshot.nodes.length);
  });
});

describe('treePositions', () => {
  it('places every node, one row per level, parents above children', () => {
    const snapshot = binarySearchTreeSnapshot();
    const { depth, children } = structuralForest(snapshot);
    const positions = treePositions(snapshot);

    expect(positions.size).toBe(snapshot.nodes.length);
    children.forEach((kids, parent) => {
      kids.forEach((kid) => {
        expect(
          (positions.get(kid)?.y as number) - (positions.get(parent)?.y as number),
        ).toBeGreaterThanOrEqual(LEVEL_SEPARATION);
      });
    });
    depth.forEach((level, id) => {
      depth.forEach((other, otherId) => {
        if (level === other) {
          expect(positions.get(id)?.y).toBe(positions.get(otherId)?.y);
        }
      });
    });
  });

  it('keeps boxes of the same row apart by at least the gap', () => {
    const snapshot = binarySearchTreeSnapshot();
    const sizes = new Map(snapshot.nodes.map((node) => [node.id, { width: 120, height: 60 }]));
    const positions = treePositions(snapshot, sizes);
    const rows = new Map<number, number[]>();

    positions.forEach((at) => rows.set(at.y, [...(rows.get(at.y) ?? []), at.x]));
    rows.forEach((xs) => {
      xs.sort((a, b) => a - b);
      xs.slice(1).forEach((x, index) =>
        expect(x - xs[index]).toBeGreaterThanOrEqual(120 + BOX_GAP),
      );
    });
  });

  it('puts the left child left of the right child', () => {
    const snapshot = binarySearchTreeSnapshot();
    const positions = treePositions(snapshot);

    snapshot.nodes.forEach((node) => {
      const left = snapshot.edges.find(
        (edge) => edge.from === node.id && edge.field === 'left',
      )?.to;
      const right = snapshot.edges.find(
        (edge) => edge.from === node.id && edge.field === 'right',
      )?.to;

      if (left && right) {
        expect(positions.get(left)?.x as number).toBeLessThan(positions.get(right)?.x as number);
      }
    });
  });

  it('gives the same layout whatever the order the extractor listed the nodes in', () => {
    const snapshot = binarySearchTreeSnapshot();
    const reversed = {
      ...snapshot,
      nodes: [...snapshot.nodes].reverse(),
      edges: [...snapshot.edges].reverse(),
    };

    expect(treePositions(reversed)).toEqual(treePositions(snapshot));
  });

  it('puts children in declaration order, not in alphabetical order', () => {
    const positions = treePositions(lowHigh(['esq', 'dir']));

    expect(positions.get('0x20')?.x as number).toBeLessThan(positions.get('0x30')?.x as number);
  });

  it('follows the order it is given', () => {
    const order = { fields: new Map([['Tree', ['dir', 'esq']]]), back: new Set<string>() };
    const positions = treePositions(lowHigh(['esq', 'dir']), undefined, order);

    expect(positions.get('0x30')?.x as number).toBeLessThan(positions.get('0x20')?.x as number);
  });
});
