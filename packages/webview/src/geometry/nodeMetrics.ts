import type { CanvasNodeKind, CardTier, Theme } from '../ui/theme';
import type { Box } from './boxes';

export const CARD_PADDING_X = 10;
export const CARD_PADDING_Y = 7;
export const CARD_RADIUS = 6;
export const CARD_MIN_WIDTH = 66;
export const CARD_MAX_WIDTH = 264;

export const NULL_PADDING_X = 7;
export const NULL_PADDING_Y = 3;
export const NULL_RADIUS = 4;
export const NULL_MIN_WIDTH = 46;

export const PILL_PADDING_Y = 6;
export const PILL_MIN_WIDTH = 70;
export const PILL_MAX_WIDTH = 220;

export const ROW_GAP = 3;
export const COLUMN_GAP = 14;
export const LINE_HEIGHT = 1.34;
export const DIVIDER_GAP = 5;
export const LEFT_SHARE = 0.5;
export const ELLIPSIS = '…';

export type CardInk = 'accent' | 'muted' | 'value' | 'address';

export interface CardLine {
  tier: CardTier;
  ink: CardInk;
  left: string;
  right?: string;
  rightInk?: CardInk;
}

export interface NodeCard {
  lines: CardLine[];
  address: string | null;
}

export interface PlacedRow {
  line: CardLine;
  top: number;
  height: number;
}

export interface NodeMetrics {
  box: Box;
  rows: PlacedRow[];
  divider: number | null;
  radius: number;
  padX: number;
}

interface Frame {
  padX: number;
  padY: number;
  radius: number;
  minWidth: number;
  maxWidth: number;
}

export function addressLine(address: string): CardLine {
  return { tier: 'note', ink: 'address', left: address };
}

export function nodeMetrics(
  card: NodeCard,
  kind: CanvasNodeKind,
  theme: Theme,
  footer: boolean,
): NodeMetrics {
  const showFooter = footer && card.address !== null;
  const lines = showFooter ? [...card.lines, addressLine(card.address as string)] : [...card.lines];

  const heights = lines.map((line) => Math.round(theme.text[line.tier] * LINE_HEIGHT));
  const stacked =
    heights.reduce((total, height) => total + height, 0) +
    ROW_GAP * Math.max(0, heights.length - 1) +
    (showFooter ? DIVIDER_GAP * 2 : 0);

  const frame = frameOf(kind, stacked);
  const room = frame.maxWidth - frame.padX * 2;
  const fitted = lines.map((line) => fitLine(line, room, theme.advance[line.tier]));
  const widest = fitted.reduce(
    (most, line) => Math.max(most, lineWidth(line, theme.advance[line.tier])),
    0,
  );
  const width = Math.round(
    Math.min(Math.max(widest + frame.padX * 2, frame.minWidth), frame.maxWidth),
  );
  const height = Math.round(stacked + frame.padY * 2);

  const rows: PlacedRow[] = [];
  let divider: number | null = null;
  let cursor = frame.padY;

  fitted.forEach((line, index) => {
    if (showFooter && index === fitted.length - 1) {
      divider = cursor + DIVIDER_GAP;
      cursor += DIVIDER_GAP * 2;
    }

    rows.push({ line, top: cursor, height: heights[index] });
    cursor += heights[index] + ROW_GAP;
  });

  return { box: { width, height }, rows, divider, radius: frame.radius, padX: frame.padX };
}

export function lineWidth(line: CardLine, advance: number): number {
  const left = line.left.length * advance;

  if (line.right === undefined) {
    return left;
  }

  return left + COLUMN_GAP + line.right.length * advance;
}

export function fitLine(line: CardLine, room: number, advance: number): CardLine {
  if (lineWidth(line, advance) <= room) {
    return line;
  }

  if (line.right === undefined) {
    return { ...line, left: clip(line.left, room, advance) };
  }

  const left = line.left.length * advance;
  const tail = room - left - COLUMN_GAP;

  if (tail >= advance * 2) {
    return { ...line, right: clip(line.right, tail, advance) };
  }

  const head = clip(line.left, room * LEFT_SHARE, advance);

  return {
    ...line,
    left: head,
    right: clip(line.right, room - head.length * advance - COLUMN_GAP, advance),
  };
}

export function clip(text: string, room: number, advance: number): string {
  if (text.length * advance <= room) {
    return text;
  }

  const keep = Math.floor(room / advance) - 1;

  if (keep < 1) {
    return room >= advance ? ELLIPSIS : '';
  }

  return `${text.slice(0, keep)}${ELLIPSIS}`;
}

function frameOf(kind: CanvasNodeKind, stacked: number): Frame {
  if (kind === 'null') {
    return {
      padX: NULL_PADDING_X,
      padY: NULL_PADDING_Y,
      radius: NULL_RADIUS,
      minWidth: NULL_MIN_WIDTH,
      maxWidth: CARD_MAX_WIDTH,
    };
  }

  if (kind === 'root' || kind === 'rootDegraded') {
    const height = stacked + PILL_PADDING_Y * 2;

    return {
      padX: Math.round(height * 0.4) + 6,
      padY: PILL_PADDING_Y,
      radius: height / 2,
      minWidth: PILL_MIN_WIDTH,
      maxWidth: PILL_MAX_WIDTH,
    };
  }

  return {
    padX: CARD_PADDING_X,
    padY: CARD_PADDING_Y,
    radius: CARD_RADIUS,
    minWidth: CARD_MIN_WIDTH,
    maxWidth: CARD_MAX_WIDTH,
  };
}
