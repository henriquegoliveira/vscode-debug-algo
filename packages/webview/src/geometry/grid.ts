export const GRID_BASE = 44;

export const GRID_MIN_SCREEN = 16;

export const GRID_DOT = 1.4;

export const GRID_ALPHA = 0.8;

export const GRID_MAX_LINES = 400;

export interface GridView {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

export interface GridPlan {
  step: number;
  left: number;
  top: number;
  columns: number;
  rows: number;
}

export function gridStep(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return GRID_BASE;
  }

  const octave = Math.ceil(Math.log2(GRID_MIN_SCREEN / (GRID_BASE * scale)));

  return GRID_BASE * Math.pow(2, octave);
}

export function gridPlan(view: GridView): GridPlan {
  const step = gridStep(view.scale);
  const left = Math.floor(view.left / step) * step;
  const top = Math.floor(view.top / step) * step;

  return {
    step,
    left,
    top,
    columns: span(view.left + view.width - left, step),
    rows: span(view.top + view.height - top, step),
  };
}

function span(distance: number, step: number): number {
  if (!Number.isFinite(distance) || distance <= 0) {
    return 0;
  }

  return Math.min(Math.floor(distance / step) + 1, GRID_MAX_LINES);
}
