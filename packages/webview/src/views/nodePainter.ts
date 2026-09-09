import type { CardInk, NodeMetrics, PlacedRow } from '../geometry/nodeMetrics';
import type { CanvasNode } from '../model/graph/types';
import type { CardTier, NodePalette, Theme } from '../ui/theme';

export const CHANGE_GLOW = 18;

export const SELECTION_WIDTH = 2;

export const SELECTION_GAP = 3;

export const DASH_PATTERN = [3, 3];

export const TYPE_WEIGHT = 700;

export const BODY_WEIGHT = 400;

export interface PaintArgs {
  ctx: CanvasRenderingContext2D;
  id: string;
  x: number;
  y: number;
  state: { selected: boolean; hover: boolean };
}

export interface Drawn {
  drawNode?: () => void;
  nodeDimensions?: { width: number; height: number };
}

export interface PaintSource {
  node: (id: string) => CanvasNode | undefined;
  theme: () => Theme;
  alpha: (id: string) => number;
}

export function nodePainter(source: PaintSource): (args: PaintArgs) => Drawn {
  return ({ ctx, id, x, y, state }) => {
    const node = source.node(id);

    if (node === undefined) {
      return {};
    }

    const theme = source.theme();
    const metrics = state.selected ? node.metricsSelected : node.metrics;
    const alpha = source.alpha(id);

    return {
      drawNode: () => {
        if (alpha <= 0) {
          return;
        }

        ctx.globalAlpha = alpha;
        paint(ctx, x, y, node, metrics, theme, state.selected);
      },
      nodeDimensions: { width: metrics.box.width, height: metrics.box.height },
    };
  };
}

function paint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: CanvasNode,
  metrics: NodeMetrics,
  theme: Theme,
  selected: boolean,
): void {
  const { width, height } = metrics.box;
  const left = x - width / 2;
  const top = y - height / 2;
  const change = node.change === undefined ? null : theme.change[node.change];

  ctx.beginPath();
  ctx.roundRect(left, top, width, height, metrics.radius);

  if (change !== null) {
    ctx.shadowColor = change;
    ctx.shadowBlur = CHANGE_GLOW;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.fillStyle = node.palette.background;
  ctx.fill();

  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;

  if (node.kind === 'null') {
    ctx.setLineDash(DASH_PATTERN);
  }

  ctx.lineWidth = node.borderWidth;
  ctx.strokeStyle = change ?? node.palette.border;
  ctx.stroke();
  ctx.setLineDash([]);

  if (selected) {
    ctx.beginPath();
    ctx.roundRect(
      left - SELECTION_GAP,
      top - SELECTION_GAP,
      width + SELECTION_GAP * 2,
      height + SELECTION_GAP * 2,
      metrics.radius + SELECTION_GAP,
    );
    ctx.lineWidth = SELECTION_WIDTH;
    ctx.strokeStyle = theme.selection;
    ctx.stroke();
  }

  if (metrics.divider !== null) {
    ctx.beginPath();
    ctx.moveTo(left + metrics.padX, top + metrics.divider);
    ctx.lineTo(left + width - metrics.padX, top + metrics.divider);
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.ink.divider;
    ctx.stroke();
  }

  ctx.textBaseline = 'middle';
  metrics.rows.forEach((row) => writeRow(ctx, row, left, top, width, metrics.padX, node, theme));
}

function writeRow(
  ctx: CanvasRenderingContext2D,
  row: PlacedRow,
  left: number,
  top: number,
  width: number,
  padX: number,
  node: CanvasNode,
  theme: Theme,
): void {
  const middle = top + row.top + row.height / 2;
  const centre = row.line.right === undefined && centred(node);

  ctx.font = fontOf(row.line.tier, theme);
  ctx.fillStyle = inkOf(row.line.ink, node.palette, theme);
  ctx.textAlign = centre ? 'center' : 'left';
  ctx.fillText(row.line.left, centre ? left + width / 2 : left + padX, middle);

  if (row.line.right === undefined) {
    return;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = inkOf(row.line.rightInk ?? 'value', node.palette, theme);
  ctx.fillText(row.line.right, left + width - padX, middle);
}

function centred(node: CanvasNode): boolean {
  return node.kind === 'root' || node.kind === 'rootDegraded' || node.kind === 'null';
}

function fontOf(tier: CardTier, theme: Theme): string {
  const weight = tier === 'type' ? TYPE_WEIGHT : BODY_WEIGHT;

  return `${weight} ${theme.text[tier]}px ${theme.fontFace}`;
}

function inkOf(ink: CardInk, palette: NodePalette, theme: Theme): string {
  if (ink === 'accent') {
    return palette.accent;
  }

  if (ink === 'muted') {
    return theme.ink.muted;
  }

  if (ink === 'address') {
    return theme.ink.address;
  }

  return theme.ink.value;
}
