import { GRID_ALPHA, GRID_DOT, gridPlan } from '../geometry/grid';
import type { Theme } from '../ui/theme';

export function paintGrid(ctx: CanvasRenderingContext2D, theme: Theme, scale: number): void {
  const at = ctx.getTransform();

  if (!(at.a > 0) || !(at.d > 0) || !(scale > 0)) {
    return;
  }

  const plan = gridPlan({
    left: -at.e / at.a,
    top: -at.f / at.d,
    width: ctx.canvas.width / at.a,
    height: ctx.canvas.height / at.d,
    scale,
  });

  if (plan.columns === 0 || plan.rows === 0) {
    return;
  }

  const dot = GRID_DOT / scale;

  ctx.save();
  ctx.globalAlpha = GRID_ALPHA;
  ctx.fillStyle = theme.grid;
  ctx.beginPath();

  for (let column = 0; column < plan.columns; column += 1) {
    const x = plan.left + column * plan.step;

    for (let row = 0; row < plan.rows; row += 1) {
      ctx.rect(x, plan.top + row * plan.step, dot, dot);
    }
  }

  ctx.fill();
  ctx.restore();
}
