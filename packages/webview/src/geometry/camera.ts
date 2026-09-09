export const CAMERA_DURATION = 320;

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export function easeInOutQuad(progress: number): number {
  const t = Math.min(Math.max(progress, 0), 1);

  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function interpolate(from: Viewport, to: Viewport, progress: number): Viewport {
  const eased = easeInOutQuad(progress);

  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: from.scale + (to.scale - from.scale) * eased,
  };
}

export function settled(from: Viewport, to: Viewport): boolean {
  return (
    Math.abs(to.x - from.x) < 0.5 &&
    Math.abs(to.y - from.y) < 0.5 &&
    Math.abs(to.scale - from.scale) < 0.001
  );
}

export interface Extent {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Frame {
  width: number;
  height: number;
}

export interface PlanLimits {
  fill: number;
  floor: number;
  ceiling: number;
  share: number;
  lazy: boolean;
}

export const FIT_FILL = 0.9;
export const FIT_MIN_SHARE = 0.05;
export const FIT_MIN_SCALE = 0.05;
export const FIT_MAX_SCALE = 1;

export const FOCUS_FILL = 0.9;
export const FOCUS_MIN_SHARE = 0.25;
export const FOCUS_MIN_SCALE = 0.3;
export const FOCUS_MAX_SCALE = 1;

export function cameraPlan(
  extent: Extent,
  frame: Frame,
  current: number,
  limits: PlanLimits,
): Viewport {
  const width = Math.max(extent.right - extent.left, 1);
  const height = Math.max(extent.bottom - extent.top, 1);
  const centre = { x: (extent.left + extent.right) / 2, y: (extent.top + extent.bottom) / 2 };

  const fits = width * current <= frame.width && height * current <= frame.height;
  const fills =
    Math.max((width * current) / frame.width, (height * current) / frame.height) >= limits.share;

  if (limits.lazy && fits && fills) {
    return { x: centre.x, y: centre.y, scale: current };
  }

  const wanted = Math.min(
    Math.max(Math.min(frame.width / width, frame.height / height) * limits.fill, limits.floor),
    limits.ceiling,
  );

  return { x: centre.x, y: centre.y, scale: wanted };
}

export const FOLLOW_FILL = 0.9;
export const FOLLOW_MIN_SCALE = 0.35;
export const FOLLOW_MAX_SCALE = 1;

export interface FollowLimits {
  fill: number;
  floor: number;
  ceiling: number;
}

export function followPlan(
  graph: Extent,
  aim: Extent | null,
  frame: Frame,
  limits: FollowLimits,
): Viewport {
  const fit = fitScale(graph, frame, limits.fill);

  if (fit >= limits.floor) {
    return { ...centreOf(graph), scale: Math.min(fit, limits.ceiling) };
  }

  const at = { ...centreOf(aim ?? graph), scale: limits.floor };

  return {
    x: within(at.x, graph.left, graph.right, frame.width / (2 * at.scale)),
    y: within(at.y, graph.top, graph.bottom, frame.height / (2 * at.scale)),
    scale: at.scale,
  };
}

function fitScale(extent: Extent, frame: Frame, fill: number): number {
  const width = Math.max(extent.right - extent.left, 1);
  const height = Math.max(extent.bottom - extent.top, 1);

  return Math.min(frame.width / width, frame.height / height) * fill;
}

function centreOf(extent: Extent): { x: number; y: number } {
  return { x: (extent.left + extent.right) / 2, y: (extent.top + extent.bottom) / 2 };
}

function within(at: number, low: number, high: number, half: number): number {
  if (high - low <= half * 2) {
    return (low + high) / 2;
  }

  return Math.min(Math.max(at, low + half), high - half);
}

export function steppedScale(
  current: number,
  direction: number,
  step: number,
  floor: number,
  ceiling: number,
): number {
  const factor = direction >= 0 ? step : 1 / step;

  return Math.min(Math.max(current * factor, floor), ceiling);
}

export function toTranslate(target: Viewport, frame: Frame): Viewport {
  return {
    x: frame.width / 2 - target.x * target.scale,
    y: frame.height / 2 - target.y * target.scale,
    scale: target.scale,
  };
}
