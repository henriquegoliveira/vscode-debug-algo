import { describe, expect, it } from 'vitest';
import type { ExtensionMessage, GraphSnapshot } from 'dbga-contract';
import { INITIAL_STATE, ScreenState, reduce } from '../../src/session/state';
import { EMPTY_ORIENTATION, foldOrientation } from '../../src/model/orientation';
import { intValue, linkedList, tree } from '../snapshots';

const pause = (value: number): GraphSnapshot => linkedList([['0x10', value]], [['0x10', null]]);

const snapshot = (sessionId: string, of: GraphSnapshot, depth = 20): ExtensionMessage => ({
  v: 1,
  type: 'snapshot',
  sessionId,
  snapshot: of,
  depth,
});

const searchTree = (high: number): GraphSnapshot =>
  tree(
    ['right', 'left'],
    [
      ['0x10', [intValue(50)]],
      ['0x20', [intValue(30)]],
      ['0x30', [intValue(high)]],
    ],
    [
      ['0x10', 'left', '0x20'],
      ['0x10', 'right', '0x30'],
    ],
  );

const run = (messages: ExtensionMessage[], from: ScreenState = INITIAL_STATE): ScreenState =>
  messages.reduce(reduce, from);

describe('reduce', () => {
  it('goes live on the first snapshot and counts it as pause 1', () => {
    const first = pause(1);
    const state = run([snapshot('a', first)]);

    expect(state.phase).toBe('live');
    expect(state.snapshot).toBe(first);
    expect(state.pauses).toBe(1);
    expect(state.history).toEqual([first]);
  });

  it('keeps counting pauses past the history window', () => {
    const pauses = [1, 2, 3, 4, 5].map(pause);
    const state = run(pauses.map((of) => snapshot('a', of, 3)));

    expect(state.pauses).toBe(5);
    expect(state.history).toEqual(pauses.slice(2));
    expect(state.snapshot).toBe(pauses[4]);
  });

  it('never keeps an empty window when the depth is below one', () => {
    const state = run([snapshot('a', pause(1), 0), snapshot('a', pause(2), 0)]);

    expect(state.history).toHaveLength(1);
  });

  it('starts over when a new session arrives', () => {
    const fresh = pause(9);
    const state = run([snapshot('a', pause(1)), snapshot('a', pause(2)), snapshot('b', fresh)]);

    expect(state.sessionId).toBe('b');
    expect(state.pauses).toBe(1);
    expect(state.history).toEqual([fresh]);
  });

  it('replays a history without lowering the pause count of the same session', () => {
    const entries = [pause(1), pause(2)];
    const live = run([snapshot('a', pause(1)), snapshot('a', pause(2)), snapshot('a', pause(3))]);
    const replayed = reduce(live, { v: 1, type: 'history', sessionId: 'a', entries });

    expect(replayed.pauses).toBe(3);
    expect(replayed.snapshot).toBe(entries[1]);
    expect(replayed.history).toBe(entries);
  });

  it('ignores an empty history', () => {
    const live = run([snapshot('a', pause(1))]);

    expect(reduce(live, { v: 1, type: 'history', sessionId: 'a', entries: [] })).toBe(live);
  });

  it('keeps the last graph when the session ends', () => {
    const last = pause(4);
    const state = run([snapshot('a', last), { v: 1, type: 'sessionEnd', sessionId: 'a' }]);

    expect(state.phase).toBe('ended');
    expect(state.snapshot).toBe(last);
  });

  it('shows an error without dropping the graph, and clears it at the next pause', () => {
    const last = pause(4);
    const failed = run([
      snapshot('a', last),
      { v: 1, type: 'error', sessionId: 'a', message: 'extraction failed' },
    ]);

    expect(failed.error).toBe('extraction failed');
    expect(failed.snapshot).toBe(last);
    expect(reduce(failed, snapshot('a', pause(5))).error).toBeNull();
  });

  it('normalizes an absent view state to null', () => {
    const state = reduce(INITIAL_STATE, {
      v: 1,
      type: 'view',
      file: '/src/list.c',
      state: undefined,
    });

    expect(state.file).toBe('/src/list.c');
    expect(state.fileView).toBeNull();
  });

  it('fixes the side of the children and forgets it in a new session', () => {
    const fixed = run([snapshot('a', searchTree(70))]);

    expect(fixed.orientation.sides).toEqual({ Tree: ['left', 'right'] });
    expect(run([snapshot('b', pause(1))], fixed).orientation).toBe(EMPTY_ORIENTATION);
  });

  it('folds a replayed history as it would fold the pauses one by one', () => {
    const entries = [searchTree(10), searchTree(70)];
    const replayed = reduce(INITIAL_STATE, { v: 1, type: 'history', sessionId: 'a', entries });

    expect(replayed.orientation).toEqual(entries.reduce(foldOrientation, EMPTY_ORIENTATION));
    expect(replayed.orientation).toEqual(run(entries.map((of) => snapshot('a', of))).orientation);
  });
});
