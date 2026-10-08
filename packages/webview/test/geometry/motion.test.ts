import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_WIDTH } from '../../src/geometry/arrows';
import {
  ENTER_SHARE,
  PULSE_GAIN,
  type Seat,
  anchorShift,
  enterAlpha,
  planMotion,
  pulseWidth,
  seatAt,
  shiftSeats,
} from '../../src/geometry/motion';

const seats = (entries: [string, number, number][]): Map<string, Seat> =>
  new Map(entries.map(([id, x, y]) => [id, { x, y }]));

describe('anchorShift', () => {
  it('cancels the shift most survivors share, not the average nor the smallest one', () => {
    const previous = seats([
      ['a', 0, 0],
      ['b', 100, 0],
      ['c', 200, 0],
      ['d', 300, 0],
    ]);
    const targets = seats([
      ['a', 50, 0],
      ['b', 150, 0],
      ['c', 250, 0],
      ['d', 305, 0],
    ]);

    expect(anchorShift(targets, previous)).toEqual({ x: -50, y: 0 });
  });

  it('keeps the layout in place when nothing survived', () => {
    expect(anchorShift(seats([['a', 10, 10]]), seats([['b', 0, 0]]))).toEqual({ x: 0, y: 0 });
  });

  it('breaks a tie towards the smaller shift', () => {
    const previous = seats([
      ['a', 0, 0],
      ['b', 0, 0],
    ]);
    const targets = seats([
      ['a', 300, 0],
      ['b', 20, 0],
    ]);

    expect(anchorShift(targets, previous)).toEqual({ x: -20, y: 0 });
  });

  it('applies the shift to every seat, and returns the same map for a zero shift', () => {
    const targets = seats([['a', 1, 2]]);

    expect(shiftSeats(targets, { x: 0, y: 0 })).toBe(targets);
    expect(shiftSeats(targets, { x: 5, y: -2 }).get('a')).toEqual({ x: 6, y: 0 });
  });
});

describe('planMotion', () => {
  it('moves survivors that changed seat and leaves still ones alone', () => {
    const placed = seats([
      ['a', 0, 0],
      ['b', 100, 0],
    ]);
    const targets = seats([
      ['a', 0, 0.2],
      ['b', 160, 0],
    ]);

    expect(planMotion(targets, placed, () => undefined)).toEqual([
      { id: 'b', from: { x: 100, y: 0 }, to: { x: 160, y: 0 }, enter: false },
    ]);
  });

  it('makes a new node enter from the seat of its parent', () => {
    const placed = seats([['parent', 40, 0]]);
    const targets = seats([
      ['parent', 40, 0],
      ['child', 40, 140],
    ]);

    expect(planMotion(targets, placed, (id) => (id === 'child' ? 'parent' : undefined))).toEqual([
      { id: 'child', from: { x: 40, y: 0 }, to: { x: 40, y: 140 }, enter: true },
    ]);
  });

  it('makes an orphan enter in place', () => {
    const targets = seats([['lone', 7, 9]]);

    expect(planMotion(targets, new Map(), () => undefined)[0].from).toEqual({ x: 7, y: 9 });
  });
});

describe('motion curves', () => {
  it('starts at the old seat and ends at the new one', () => {
    const motion = { id: 'a', from: { x: 0, y: 0 }, to: { x: 100, y: -40 }, enter: false };

    expect(seatAt(motion, 0)).toEqual({ x: 0, y: 0 });
    expect(seatAt(motion, 1)).toEqual({ x: 100, y: -40 });
    expect(seatAt(motion, 0.5)).toEqual({ x: 50, y: -20 });
  });

  it('fades a new node in during the first share of the motion', () => {
    expect(enterAlpha(0)).toBe(0);
    expect(enterAlpha(ENTER_SHARE)).toBe(1);
    expect(enterAlpha(1)).toBe(1);
  });

  it('pulses around the highlight width and settles on it', () => {
    const samples = Array.from({ length: 101 }, (_, step) => pulseWidth(step / 100));

    expect(pulseWidth(0)).toBe(HIGHLIGHT_WIDTH);
    expect(pulseWidth(1)).toBeCloseTo(HIGHLIGHT_WIDTH);
    samples.forEach((width) => {
      expect(width).toBeGreaterThanOrEqual(HIGHLIGHT_WIDTH);
      expect(width).toBeLessThanOrEqual(HIGHLIGHT_WIDTH + PULSE_GAIN);
    });
  });
});
