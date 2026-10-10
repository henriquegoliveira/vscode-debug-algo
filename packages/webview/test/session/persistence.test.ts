import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILE_VIEW,
  DEFAULT_PANEL_STATE,
  MAX_COLUMN_WIDTH,
  MAX_SCALE,
  MIN_COLUMN_WIDTH,
  MIN_SCALE,
  coerceCamera,
  coerceCameras,
  coerceFields,
  coerceFile,
  coercePanel,
} from '../../src/session/persistence';

describe('coercePanel', () => {
  it('falls back to the defaults for anything that is not a plain object', () => {
    [undefined, null, 42, 'state', [1, 2]].forEach((stored) => {
      expect(coercePanel(stored)).toEqual(DEFAULT_PANEL_STATE);
    });
  });

  it('returns a views map that is not shared with the defaults', () => {
    const state = coercePanel(undefined);

    expect(state.views).not.toBe(DEFAULT_PANEL_STATE.views);
  });

  it('clamps the column width and ignores non-finite numbers', () => {
    expect(coercePanel({ columnWidth: 10 }).columnWidth).toBe(MIN_COLUMN_WIDTH);
    expect(coercePanel({ columnWidth: 10_000 }).columnWidth).toBe(MAX_COLUMN_WIDTH);
    expect(coercePanel({ columnWidth: Number.NaN }).columnWidth).toBe(
      DEFAULT_PANEL_STATE.columnWidth,
    );
    expect(coercePanel({ columnScroll: -5 }).columnScroll).toBe(0);
  });

  it('keeps well-formed values and drops malformed lists', () => {
    const state = coercePanel({
      selectedId: 'n:0x10',
      columnOpen: true,
      frames: ['main#1'],
      tracks: ['list', 3],
    });

    expect(state.selectedId).toBe('n:0x10');
    expect(state.columnOpen).toBe(true);
    expect(state.frames).toEqual(['main#1']);
    expect(state.tracks).toBeNull();
  });
});

describe('coerceCamera', () => {
  it('clamps the scale and keeps the position', () => {
    expect(coerceCamera({ scale: 99, x: 3, y: -4 })).toEqual({ scale: MAX_SCALE, x: 3, y: -4 });
    expect(coerceCamera({ scale: 0, x: 0, y: 0 })).toEqual({ scale: MIN_SCALE, x: 0, y: 0 });
  });

  it('rejects a camera with a missing or non-finite coordinate', () => {
    expect(coerceCamera({ scale: 1, x: 0 })).toBeNull();
    expect(coerceCamera({ scale: 1, x: Number.POSITIVE_INFINITY, y: 0 })).toBeNull();
  });

  it('keeps cameras only for the known view modes', () => {
    const cameras = coerceCameras({
      graph: { scale: 1, x: 0, y: 0 },
      sorting: 'wide',
      timeline: { scale: 1, x: 0, y: 0 },
    });

    expect(Object.keys(cameras)).toEqual(['graph']);
  });
});

describe('coerceFile', () => {
  it('replaces every unknown choice with its default', () => {
    expect(
      coerceFile({
        layoutChoice: 'circular',
        nullTerminals: 'yes',
        frameMode: 'some',
        follow: 1,
        viewMode: 'table',
        mirrored: ['Tree', 1],
      }),
    ).toEqual(DEFAULT_FILE_VIEW);
  });

  it('keeps valid choices', () => {
    const view = coerceFile({
      layoutChoice: 'hierarchical',
      nullTerminals: true,
      frameMode: 'all',
      follow: true,
      viewMode: 'sorting',
      fields: { Node: 'all' },
      mirrored: ['Tree'],
    });

    expect(view).toEqual({
      layoutChoice: 'hierarchical',
      nullTerminals: true,
      frameMode: 'all',
      follow: true,
      viewMode: 'sorting',
      fields: { Node: 'all' },
      mirrored: ['Tree'],
    });
  });

  it('accepts all, none or a list of names as a field choice', () => {
    expect(
      coerceFields({ Node: 'none', Tree: ['key', 'left'], Bad: ['key', 1], Other: 'some' }),
    ).toEqual({ Node: 'none', Tree: ['key', 'left'] });
  });
});
