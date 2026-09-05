export const EDGE_WIDTH = 2;

export const HIGHLIGHT_WIDTH = 3;

export const ARROW_SCALE = 0.7;

export const ARROW_BASE = 15;

export const ARROW_PER_WIDTH = 3;

export const ARROW_MIN_SCALE = 0.05;

export function arrowLength(scaleFactor: number, width: number): number {
  return ARROW_BASE * scaleFactor + ARROW_PER_WIDTH * width;
}

export function arrowScale(width: number): number {
  const wanted = arrowLength(ARROW_SCALE, EDGE_WIDTH) - ARROW_PER_WIDTH * width;

  return Math.max(ARROW_MIN_SCALE, wanted / ARROW_BASE);
}
