import { describe, expect, it } from 'vitest';
import {
  reachableNodes,
  reciprocalPairs,
  visibleSnapshot,
} from '../../../src/model/graph/visibility';
import { linkedList, linkedListDoubleSnapshot, pointerRoot } from '../../snapshots';

const twoFrames = () => {
  const snapshot = linkedList(
    [
      ['0x10', 1],
      ['0x20', 2],
      ['0x30', 3],
    ],
    [
      ['0x10', '0x20'],
      ['0x20', null],
      ['0x30', null],
    ],
  );
  snapshot.roots = [pointerRoot('head', '0x10', 1), pointerRoot('fresh', '0x30', 0)];

  return snapshot;
};

describe('reachableNodes', () => {
  it('follows edges from the roots of the chosen frames only', () => {
    expect([...reachableNodes(twoFrames(), new Set(['main#1']))].sort()).toEqual(['0x10', '0x20']);
    expect([...reachableNodes(twoFrames(), new Set(['push#0']))]).toEqual(['0x30']);
  });

  it('keeps nodes that no root reaches, so nothing extracted disappears', () => {
    const snapshot = twoFrames();
    snapshot.roots = [pointerRoot('head', '0x10', 1)];

    expect(reachableNodes(snapshot, new Set(['main#1'])).has('0x30')).toBe(true);
  });
});

describe('visibleSnapshot', () => {
  it('returns the same snapshot when no frame filter is set', () => {
    const snapshot = twoFrames();

    expect(visibleSnapshot(snapshot)).toBe(snapshot);
  });

  it('drops the nodes and edges of the frames left out', () => {
    const view = visibleSnapshot(twoFrames(), new Set(['main#1']));

    expect(view.nodes.map((node) => node.id)).toEqual(['0x10', '0x20']);
    expect(view.edges.every((edge) => edge.from !== '0x30')).toBe(true);
  });
});

describe('reciprocalPairs', () => {
  it('finds both directions of every prev/next pair of a doubly linked list', () => {
    const snapshot = linkedListDoubleSnapshot();
    const pairs = reciprocalPairs(snapshot);
    const linked = snapshot.edges.filter((edge) => edge.to !== null);

    expect(pairs.size).toBe(linked.length);
    linked.forEach((edge) => expect(pairs.has(`${edge.to} ${edge.from}`)).toBe(true));
  });

  it('finds none in a singly linked list', () => {
    expect(reciprocalPairs(twoFrames()).size).toBe(0);
  });
});
