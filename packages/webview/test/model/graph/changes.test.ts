import { describe, expect, it } from 'vitest';
import { changedNodes, focusTarget } from '../../../src/model/graph/changes';
import { linkedList } from '../../snapshots';

const before = () =>
  linkedList(
    [
      ['0x10', 1],
      ['0x20', 2],
    ],
    [
      ['0x10', '0x20'],
      ['0x20', null],
    ],
  );

describe('changedNodes', () => {
  it('reports nothing between two identical pauses', () => {
    expect(changedNodes(before(), before())).toEqual({
      created: [],
      relinked: [],
      valued: [],
      destinations: {},
      edges: [],
    });
  });

  it('reports an inserted node as created and its predecessor as relinked', () => {
    const after = linkedList(
      [
        ['0x10', 1],
        ['0x30', 3],
        ['0x20', 2],
      ],
      [
        ['0x10', '0x30'],
        ['0x30', '0x20'],
        ['0x20', null],
      ],
    );

    const changes = changedNodes(before(), after);

    expect(changes.created).toEqual(['0x30']);
    expect(changes.relinked).toEqual(['0x10']);
    expect(changes.destinations).toEqual({ '0x10': ['0x30'] });
    expect(changes.edges).toEqual(['0x10:next']);
  });

  it('reports a field change on a node that kept its links as valued', () => {
    const after = linkedList(
      [
        ['0x10', 1],
        ['0x20', 7],
      ],
      [
        ['0x10', '0x20'],
        ['0x20', null],
      ],
    );

    const changes = changedNodes(before(), after);

    expect(changes.valued).toEqual(['0x20']);
    expect(changes.relinked).toEqual([]);
  });

  it('reports a pointer set to NULL as relinked without a destination', () => {
    const after = linkedList(
      [
        ['0x10', 1],
        ['0x20', 2],
      ],
      [
        ['0x10', null],
        ['0x20', null],
      ],
    );

    const changes = changedNodes(before(), after);

    expect(changes.relinked).toEqual(['0x10']);
    expect(changes.destinations).toEqual({});
  });
});

describe('focusTarget', () => {
  it('aims at the drawn changes and their destinations, in a stable order', () => {
    const after = linkedList(
      [
        ['0x10', 1],
        ['0x30', 3],
        ['0x20', 2],
      ],
      [
        ['0x10', '0x30'],
        ['0x30', '0x20'],
        ['0x20', null],
      ],
    );
    const changes = changedNodes(before(), after);

    expect(focusTarget(after, changes, new Set(['n:0x10', 'n:0x30']))).toEqual([
      'n:0x10',
      'n:0x30',
    ]);
    expect(focusTarget(after, changes, new Set(['n:0x10']))).toEqual(['n:0x10']);
  });
});
