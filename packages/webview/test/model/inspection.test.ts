import { describe, expect, it } from 'vitest';
import type { GraphSnapshot } from 'dbga-contract';
import { annotationTargets, buildIndex, inspect } from '../../src/model/inspection';
import { binarySearchTreeSnapshot, linkedList, pointerRoot } from '../snapshots';

const withUnexpandedBuffer = (): GraphSnapshot => {
  const snapshot = linkedList([['0x10', 1]], [['0x10', '0x90']]);
  snapshot.nodes.push({ kind: 'opaque', id: '0x90', type: 'int', reason: 'notExpanded' });
  snapshot.roots = [
    pointerRoot('head', '0x10', 1),
    { ...pointerRoot('data', '0x90', 0), type: 'int *' },
    { ...pointerRoot('data', '0x90', 1), type: 'int *' },
  ];

  return snapshot;
};

describe('inspect', () => {
  it('lists the scalar fields and the pointer fields of a record', () => {
    const snapshot = binarySearchTreeSnapshot();
    const root = snapshot.nodes[0];
    const inspection = inspect(buildIndex(snapshot), `n:${root.id}`);

    expect(inspection?.space).toBe('node');
    if (inspection?.space !== 'node') {
      return;
    }
    expect(inspection.address).toBe(root.id);
    expect(inspection.fields.length).toBeGreaterThan(0);
    expect(inspection.pointers.map((row) => row.field).sort()).toEqual(['left', 'right']);
  });

  it('points each non-null pointer row at the canvas node it reaches', () => {
    const snapshot = binarySearchTreeSnapshot();
    const root = snapshot.nodes[0];
    const inspection = inspect(buildIndex(snapshot), `n:${root.id}`);
    const left = snapshot.edges.find((edge) => edge.from === root.id && edge.field === 'left');

    expect(inspection).toMatchObject({
      space: 'node',
      pointers: expect.arrayContaining([
        { field: 'left', type: 'TreeNode *', canvasId: `n:${left?.to}` },
      ]),
    });
  });

  it('returns null for an id that names nothing in the snapshot', () => {
    const index = buildIndex(binarySearchTreeSnapshot());

    expect(inspect(index, 'n:0xdead')).toBeNull();
    expect(inspect(index, 'x:anything')).toBeNull();
  });
});

describe('annotationTargets', () => {
  it('offers a pointer root whose target was not expanded', () => {
    const index = buildIndex(withUnexpandedBuffer());

    expect(annotationTargets(index, 'r:push#0:data')).toEqual([
      { label: 'data', path: 'push:data' },
    ]);
  });

  it('qualifies the path by function only when the name repeats in scope', () => {
    const index = buildIndex(withUnexpandedBuffer());

    expect(annotationTargets(index, 'r:push#0:data', new Set(['push#0']))).toEqual([
      { label: 'data', path: 'data' },
    ]);
  });

  it('offers the unexpanded fields of a record reached through a pointer', () => {
    const index = buildIndex(withUnexpandedBuffer());

    expect(annotationTargets(index, 'n:0x10')).toEqual([
      { label: 'head->next', path: 'head->next' },
    ]);
  });

  it('offers nothing for a pointer that was already expanded', () => {
    const index = buildIndex(binarySearchTreeSnapshot());

    expect(annotationTargets(index, 'r:removal#1:ptRoot')).toEqual([]);
  });
});
