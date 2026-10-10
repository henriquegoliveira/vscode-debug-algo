import { describe, expect, it } from 'vitest';
import type { GraphSnapshot, Value } from 'dbga-contract';
import {
  EMPTY_ORIENTATION,
  childSides,
  foldOrientation,
  treeOrder,
} from '../../src/model/orientation';
import {
  binarySearchTreeSnapshot,
  intValue,
  linkedListDoubleSnapshot,
  textValue,
  tree,
} from '../snapshots';

const enumValue = (v: number): Value => ({ t: 'enum', v, name: null });

const search = (sides: [string, string], [low, high]: [string, string]): GraphSnapshot =>
  tree(
    sides,
    [
      ['0x10', [intValue(50)]],
      ['0x20', [intValue(30)]],
      ['0x30', [intValue(70)]],
    ],
    [
      ['0x10', low, '0x20'],
      ['0x10', high, '0x30'],
      ['0x20', low, null],
      ['0x20', high, null],
      ['0x30', low, null],
      ['0x30', high, null],
    ],
  );

const fixedSides = (snapshot: GraphSnapshot): string[] | undefined =>
  foldOrientation(EMPTY_ORIENTATION, snapshot).sides.Tree;

describe('foldOrientation', () => {
  it('fixes the smaller-key child on the left whatever the field names', () => {
    expect(fixedSides(search(['esq', 'dir'], ['esq', 'dir']))).toEqual(['esq', 'dir']);
    expect(fixedSides(search(['dir', 'esq'], ['esq', 'dir']))).toEqual(['esq', 'dir']);
  });

  it('fixes left first in a tree that declares right before left', () => {
    expect(fixedSides(search(['right', 'left'], ['left', 'right']))).toEqual(['left', 'right']);
  });

  it('leaves an ascending chain provisional', () => {
    const chain = tree(
      ['right', 'left'],
      [
        ['0x10', [intValue(1)]],
        ['0x20', [intValue(2)]],
        ['0x30', [intValue(3)]],
      ],
      [
        ['0x10', 'right', '0x20'],
        ['0x20', 'right', '0x30'],
      ],
    );

    expect(fixedSides(chain)).toBeUndefined();
    expect(treeOrder(chain, EMPTY_ORIENTATION, []).fields.get('Tree')).toEqual(['right', 'left']);
  });

  it('finds no side when both children are smaller, as in a Huffman tree', () => {
    const huffman = tree(
      ['left', 'right'],
      [
        ['0x10', [intValue(10)]],
        ['0x20', [intValue(4)]],
        ['0x30', [intValue(6)]],
      ],
      [
        ['0x10', 'left', '0x20'],
        ['0x10', 'right', '0x30'],
      ],
    );

    expect(fixedSides(huffman)).toBeUndefined();
  });

  it('finds no side when two key fields disagree', () => {
    const disagreeing = tree(
      ['left', 'right'],
      [
        ['0x10', [intValue(10), enumValue(0)]],
        ['0x20', [intValue(5), enumValue(1)]],
        ['0x30', [intValue(7), enumValue(0)]],
      ],
      [
        ['0x10', 'left', '0x20'],
        ['0x20', 'right', '0x30'],
      ],
    );

    expect(fixedSides(disagreeing)).toBeUndefined();
  });

  it('compares text keys, and ignores truncated ones', () => {
    const words = (truncated: boolean): GraphSnapshot =>
      tree(
        ['right', 'left'],
        [
          ['0x10', [textValue('m', truncated)]],
          ['0x20', [textValue('c', truncated)]],
          ['0x30', [textValue('x', truncated)]],
        ],
        [
          ['0x10', 'left', '0x20'],
          ['0x10', 'right', '0x30'],
        ],
      );

    expect(fixedSides(words(false))).toEqual(['left', 'right']);
    expect(fixedSides(words(true))).toBeUndefined();
  });

  it('keeps a fixed side through a snapshot that contradicts it', () => {
    const fixed = foldOrientation(EMPTY_ORIENTATION, search(['left', 'right'], ['left', 'right']));
    const rotating = search(['left', 'right'], ['right', 'left']);

    expect(foldOrientation(fixed, rotating)).toBe(fixed);
  });

  it('fixes the field that walks away from the head as the forward one', () => {
    const fold = foldOrientation(EMPTY_ORIENTATION, linkedListDoubleSnapshot());

    expect(fold.back).toEqual(['prev']);
    expect([...treeOrder(linkedListDoubleSnapshot(), fold, []).back]).toEqual(['prev']);
  });

  it('falls back to the last declared field when head and tail tie', () => {
    const deque = tree(
      ['prev', 'next'],
      [
        ['0x10', [intValue(1)]],
        ['0x20', [intValue(2)]],
        ['0x30', [intValue(3)]],
      ],
      [
        ['0x10', 'next', '0x20'],
        ['0x20', 'next', '0x30'],
        ['0x20', 'prev', '0x10'],
        ['0x30', 'prev', '0x20'],
      ],
      ['0x10', '0x30'],
    );

    expect(foldOrientation(EMPTY_ORIENTATION, deque).back).toEqual([]);
    expect([...treeOrder(deque, EMPTY_ORIENTATION, []).back]).toEqual(['next']);
  });

  it('keeps parent as the way back by its number of partners', () => {
    const parented = tree(
      ['left', 'right', 'parent'],
      [
        ['0x10', [intValue(50)]],
        ['0x20', [intValue(30)]],
        ['0x30', [intValue(70)]],
      ],
      [
        ['0x10', 'left', '0x20'],
        ['0x10', 'right', '0x30'],
        ['0x10', 'parent', null],
        ['0x20', 'parent', '0x10'],
        ['0x30', 'parent', '0x10'],
      ],
    );
    const order = treeOrder(parented, foldOrientation(EMPTY_ORIENTATION, parented), []);

    expect([...order.back]).toEqual(['parent']);
    expect(childSides(parented, order, 'Tree')).toEqual(['left', 'right']);
  });

  it('fixes left before right on a real binary search tree', () => {
    const snapshot = binarySearchTreeSnapshot();

    expect(foldOrientation(EMPTY_ORIENTATION, snapshot).sides).toEqual({
      TreeNode: ['left', 'right'],
    });
  });
});

describe('treeOrder', () => {
  it('lets the mirror override a fixed side', () => {
    const snapshot = search(['left', 'right'], ['left', 'right']);
    const fold = foldOrientation(EMPTY_ORIENTATION, snapshot);

    expect(treeOrder(snapshot, fold, ['Tree']).fields.get('Tree')).toEqual(['right', 'left']);
  });
});
