import { describe, expect, it } from 'vitest';
import {
  FIT_FILL,
  FIT_MAX_SCALE,
  FIT_MIN_SCALE,
  FIT_MIN_SHARE,
  FOLLOW_FILL,
  FOLLOW_MAX_SCALE,
  FOLLOW_MIN_SCALE,
  cameraPlan,
  easeInOutQuad,
  followPlan,
  interpolate,
  settled,
  steppedScale,
  toTranslate,
} from '../../src/geometry/camera';

const FOLLOW = { fill: FOLLOW_FILL, floor: FOLLOW_MIN_SCALE, ceiling: FOLLOW_MAX_SCALE };
const FIT = {
  fill: FIT_FILL,
  floor: FIT_MIN_SCALE,
  ceiling: FIT_MAX_SCALE,
  share: FIT_MIN_SHARE,
  lazy: false,
};
const FRAME = { width: 800, height: 600 };

describe('easeInOutQuad', () => {
  it('starts at 0, passes 0.5 halfway and ends at 1', () => {
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(0.5)).toBe(0.5);
    expect(easeInOutQuad(1)).toBe(1);
    expect(easeInOutQuad(-1)).toBe(0);
    expect(easeInOutQuad(2)).toBe(1);
  });
});

describe('followPlan', () => {
  it('frames the whole graph when it fits above the minimum scale', () => {
    const graph = { left: 0, right: 400, top: 0, bottom: 200 };
    const plan = followPlan(graph, { left: 390, right: 400, top: 190, bottom: 200 }, FRAME, FOLLOW);

    expect(plan.x).toBe(200);
    expect(plan.y).toBe(100);
    expect(plan.scale).toBe(FOLLOW_MAX_SCALE);
  });

  it('centres on the change at the minimum scale when the graph is too large', () => {
    const graph = { left: 0, right: 20_000, top: 0, bottom: 600 };
    const aim = { left: 9_900, right: 10_100, top: 250, bottom: 350 };
    const plan = followPlan(graph, aim, FRAME, FOLLOW);

    expect(plan.scale).toBe(FOLLOW_MIN_SCALE);
    expect(plan.x).toBe(10_000);
  });

  it('does not slide past the edge of the graph when the change is near it', () => {
    const graph = { left: 0, right: 20_000, top: 0, bottom: 600 };
    const plan = followPlan(graph, { left: 0, right: 10, top: 0, bottom: 10 }, FRAME, FOLLOW);

    expect(plan.x).toBeCloseTo(FRAME.width / (2 * FOLLOW_MIN_SCALE));
  });
});

describe('cameraPlan', () => {
  it('fits the extent into the frame with the fill margin', () => {
    const plan = cameraPlan({ left: 0, right: 1600, top: 0, bottom: 600 }, FRAME, 1, FIT);

    expect(plan.scale).toBeCloseTo(0.5 * FIT_FILL);
    expect(plan).toMatchObject({ x: 800, y: 300 });
  });

  it('keeps the current scale when lazy and the extent already fits', () => {
    const extent = { left: 0, right: 400, top: 0, bottom: 300 };

    expect(cameraPlan(extent, FRAME, 0.8, { ...FIT, lazy: true }).scale).toBe(0.8);
  });
});

describe('viewport helpers', () => {
  it('interpolates and detects a settled camera', () => {
    const from = { x: 0, y: 0, scale: 1 };
    const to = { x: 100, y: 50, scale: 2 };

    expect(interpolate(from, to, 1)).toEqual(to);
    expect(settled(from, interpolate(from, to, 1))).toBe(false);
    expect(settled(to, { x: 100.2, y: 49.9, scale: 2 })).toBe(true);
  });

  it('steps the zoom within its bounds', () => {
    expect(steppedScale(1, 1, 1.25, 0.1, 4)).toBe(1.25);
    expect(steppedScale(1, -1, 1.25, 0.1, 4)).toBe(0.8);
    expect(steppedScale(3.9, 1, 1.25, 0.1, 4)).toBe(4);
  });

  it('turns a camera target into the translation that centres it', () => {
    expect(toTranslate({ x: 100, y: 50, scale: 2 }, FRAME)).toEqual({ x: 200, y: 200, scale: 2 });
  });
});
