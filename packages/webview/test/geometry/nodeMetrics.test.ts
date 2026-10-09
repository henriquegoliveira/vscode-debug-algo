import { describe, expect, it } from 'vitest';
import {
  CARD_MAX_WIDTH,
  CARD_MIN_WIDTH,
  ELLIPSIS,
  type CardLine,
  clip,
  fitLine,
  lineWidth,
  nodeMetrics,
} from '../../src/geometry/nodeMetrics';
import { FALLBACK_THEME } from '../../src/ui/theme';

const ADVANCE = 7;

const line = (left: string, right?: string): CardLine => ({
  tier: 'field',
  ink: 'value',
  left,
  right,
});

describe('clip', () => {
  it('keeps text that fits and cuts the rest with an ellipsis', () => {
    expect(clip('value', 5 * ADVANCE, ADVANCE)).toBe('value');
    expect(clip('a long field name', 6 * ADVANCE, ADVANCE)).toBe(`a lon${ELLIPSIS}`);
  });

  it('leaves only the ellipsis, or nothing, when there is almost no room', () => {
    expect(clip('abc', ADVANCE, ADVANCE)).toBe(ELLIPSIS);
    expect(clip('abc', ADVANCE / 2, ADVANCE)).toBe('');
  });
});

describe('fitLine', () => {
  it('never returns a line wider than the room', () => {
    const room = 20 * ADVANCE;

    [
      line('name', 'x'.repeat(50)),
      line('y'.repeat(50), 'x'.repeat(50)),
      line('z'.repeat(80)),
    ].forEach((candidate) => {
      expect(lineWidth(fitLine(candidate, room, ADVANCE), ADVANCE)).toBeLessThanOrEqual(room);
    });
  });

  it('cuts the value before the name when the name fits', () => {
    const fitted = fitLine(line('next', '0x'.repeat(40)), 20 * ADVANCE, ADVANCE);

    expect(fitted.left).toBe('next');
    expect(fitted.right?.endsWith(ELLIPSIS)).toBe(true);
  });
});

describe('nodeMetrics', () => {
  const card = (lines: CardLine[]) => ({ lines, address: '0x555555559010' });

  it('keeps a card between the minimum and maximum widths', () => {
    expect(nodeMetrics(card([line('a')]), 'record', FALLBACK_THEME, false).box.width).toBe(
      CARD_MIN_WIDTH,
    );
    const wide = nodeMetrics(card([line('w'.repeat(200))]), 'record', FALLBACK_THEME, false);
    const glyph = FALLBACK_THEME.advance.field;

    expect(wide.box.width).toBeLessThanOrEqual(CARD_MAX_WIDTH);
    expect(wide.box.width).toBeGreaterThan(CARD_MAX_WIDTH - 2 * glyph);
    expect(wide.rows[0].line.left.endsWith(ELLIPSIS)).toBe(true);
  });

  it('does not change the width when the address footer is shown', () => {
    const lines = [line('value', '42'), line('next', '0x555555559030')];
    const bare = nodeMetrics(card(lines), 'record', FALLBACK_THEME, false);
    const selected = nodeMetrics(card(lines), 'record', FALLBACK_THEME, true);

    expect(selected.box.width).toBe(bare.box.width);
    expect(selected.box.height).toBeGreaterThan(bare.box.height);
    expect(selected.divider).not.toBeNull();
    expect(bare.divider).toBeNull();
  });

  it('stacks the rows from top to bottom without overlap', () => {
    const metrics = nodeMetrics(
      card([line('a'), line('b'), line('c')]),
      'record',
      FALLBACK_THEME,
      false,
    );

    metrics.rows.slice(1).forEach((row, index) => {
      const above = metrics.rows[index];
      expect(row.top).toBeGreaterThanOrEqual(above.top + above.height);
    });
  });
});
