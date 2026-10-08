import { describe, expect, it } from 'vitest';
import {
  forwardDegree,
  layoutForChoice,
  promotes,
  resolveLayout,
} from '../../src/model/layoutRule';
import {
  binarySearchTreeSnapshot,
  linkedListCyclicSnapshot,
  linkedListDoubleSnapshot,
  sortingMergePauses,
} from '../snapshots';

describe('resolveLayout', () => {
  it('lays a binary tree out hierarchically', () => {
    expect(resolveLayout(binarySearchTreeSnapshot())).toBe('hierarchical');
  });

  it('uses physics for lists, cyclic or doubly linked', () => {
    expect(resolveLayout(linkedListCyclicSnapshot())).toBe('physics');
    expect(resolveLayout(linkedListDoubleSnapshot())).toBe('physics');
  });

  it('keeps the default layout when no observed type has a pointer field', () => {
    const [arrays] = sortingMergePauses();

    expect(resolveLayout(arrays)).toBe('default');
  });

  it('does not count the back pointer of a doubly linked list as a branch', () => {
    expect(forwardDegree(linkedListDoubleSnapshot())).toBe(1);
  });
});

describe('promotes', () => {
  it('only moves up the rank, from default to physics to hierarchical', () => {
    expect(promotes('default', 'physics')).toBe(true);
    expect(promotes('physics', 'hierarchical')).toBe(true);
    expect(promotes('hierarchical', 'physics')).toBe(false);
    expect(promotes('physics', 'physics')).toBe(false);
  });
});

describe('layoutForChoice', () => {
  it('lets an explicit choice override the type rule', () => {
    expect(layoutForChoice('physics', binarySearchTreeSnapshot())).toBe('physics');
    expect(layoutForChoice('auto', binarySearchTreeSnapshot())).toBe('hierarchical');
  });
});
