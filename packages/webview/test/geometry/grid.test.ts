import { describe, expect, it } from 'vitest';
import {
  GRID_BASE,
  GRID_MAX_LINES,
  GRID_MIN_SCREEN,
  gridPattern,
  gridPlan,
  gridStep,
} from '../../src/geometry/grid';

describe('gridStep', () => {
  it('doubles the step so the screen spacing never drops below the minimum', () => {
    [0.05, 0.1, 0.3, 0.5, 1, 2, 4].forEach((scale) => {
      const onScreen = gridStep(scale) * scale;

      expect(onScreen).toBeGreaterThanOrEqual(GRID_MIN_SCREEN);
      expect(onScreen).toBeLessThan(GRID_MIN_SCREEN * 2);
    });
  });

  it('falls back to the base step for an invalid scale', () => {
    expect(gridStep(0)).toBe(GRID_BASE);
    expect(gridStep(Number.NaN)).toBe(GRID_BASE);
  });
});

describe('gridPlan and gridPattern', () => {
  it('agree on the spacing, so the canvas and the CSS grids line up', () => {
    [0.2, 0.7, 1, 3].forEach((scale) => {
      const plan = gridPlan({ left: -123, top: 57, width: 800, height: 600, scale });

      expect(gridPattern(scale).size).toBeCloseTo(plan.step * scale);
    });
  });

  it('starts on a grid line at or before the visible corner', () => {
    const plan = gridPlan({ left: -123, top: 57, width: 800, height: 600, scale: 1 });

    expect(plan.left % plan.step).toBe(-0);
    expect(plan.left).toBeLessThanOrEqual(-123);
    expect(plan.top).toBeLessThanOrEqual(57);
  });

  it('caps the number of lines', () => {
    const plan = gridPlan({ left: 0, top: 0, width: 1e9, height: 1e9, scale: 1 });

    expect(plan.columns).toBe(GRID_MAX_LINES);
    expect(plan.rows).toBe(GRID_MAX_LINES);
  });
});
