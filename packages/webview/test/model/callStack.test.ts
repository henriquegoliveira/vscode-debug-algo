import { describe, expect, it } from 'vitest';
import { callStackModel } from '../../src/model/callStack';
import { recursionPauses } from '../snapshots';

describe('callStackModel', () => {
  it('builds one card per frame, with the current frame first', () => {
    const [first] = recursionPauses();
    const model = callStackModel(first);

    expect(model.frames.map((frame) => frame.level)).toEqual(
      first.frames.map((frame) => frame.level),
    );
    expect(model.frames.filter((frame) => frame.isCurrent).map((frame) => frame.level)).toEqual([
      0,
    ]);
  });

  it('puts each root under the frame it was read from', () => {
    const [first] = recursionPauses();
    const model = callStackModel(first);
    const placed = model.frames.reduce((total, frame) => total + frame.roots.length, 0);
    const locals = first.roots.filter((root) => root.origin !== 'global').length;

    expect(placed).toBe(locals);
    expect(model.globals).toHaveLength(first.roots.length - locals);
  });

  it('marks no change without a previous pause', () => {
    const [first] = recursionPauses();

    expect(callStackModel(first).frames.every((frame) => frame.changedRoots.size === 0)).toBe(true);
  });

  it('marks the roots whose value changed since the previous pause', () => {
    const [first, second] = recursionPauses();
    const changed = callStackModel(second, first).frames.flatMap((frame) => [
      ...frame.changedRoots,
    ]);

    expect(changed.length).toBeGreaterThan(0);
    expect(
      callStackModel(second, second).frames.every((frame) => frame.changedRoots.size === 0),
    ).toBe(true);
  });
});
