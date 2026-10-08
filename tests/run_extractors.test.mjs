import { describe, expect, it } from 'vitest';
import { declaredDivergence, stackGarbageIsStable } from './run_extractors.mjs';

const HOME = {};
const FOREIGN = { DBGA_FOREIGN_STACK: '1' };

describe('stackGarbageIsStable', () => {
  it('trusts the stack only on the machine that recorded the baselines', () => {
    expect(stackGarbageIsStable('linux', HOME)).toBe(true);
    expect(stackGarbageIsStable('linux', FOREIGN)).toBe(false);
    expect(stackGarbageIsStable('win32', HOME)).toBe(false);
  });
});

describe('declaredDivergence', () => {
  it('declares nothing on the baseline machine', () => {
    ['linked_list_simple', 'huffman', 'class_reference', 'binary_search_tree'].forEach((target) => {
      expect(declaredDivergence(target, 'linux', 'baseline', HOME)).toBe(false);
      expect(declaredDivergence(target, 'linux', 'parity', HOME)).toBe(false);
    });
  });

  it('declares the targets that read uninitialized memory on a foreign Linux stack', () => {
    ['linked_list_simple', 'linked_list_cyclic', 'garbage_pointer', 'huffman'].forEach((target) => {
      expect(declaredDivergence(target, 'linux', 'baseline', FOREIGN)).toBe(true);
      expect(declaredDivergence(target, 'linux', 'parity', FOREIGN)).toBe(true);
    });
  });

  it('keeps every other target strict on a foreign Linux stack', () => {
    ['binary_search_tree', 'class_reference', 'sorting_quick_random', 'scalar_values'].forEach(
      (target) => {
        expect(declaredDivergence(target, 'linux', 'baseline', FOREIGN)).toBe(false);
        expect(declaredDivergence(target, 'linux', 'parity', FOREIGN)).toBe(false);
      },
    );
  });

  it('keeps the Windows declarations', () => {
    expect(declaredDivergence('class_reference', 'win32', 'parity', HOME)).toBe(true);
    expect(declaredDivergence('sorting_quick_random', 'win32', 'baseline', HOME)).toBe(true);
    expect(declaredDivergence('scalar_values', 'win32', 'parity', HOME)).toBe(false);
  });
});
