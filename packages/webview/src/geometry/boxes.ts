import type { CanvasNodeKind } from '../ui/theme';

export const FONT_SIZE = 14;
export const CHAR_ADVANCE = 8.4;
export const NODE_MARGIN = 5;
export const DOT_DIAMETER = 50;
export const BOX_GAP = 60;
export const LEVEL_GAP = 90;

export interface Box {
  width: number;
  height: number;
}

export interface Placed {
  x: number;
  y: number;
  box: Box;
}

export function textSize(label: string): Box {
  const lines = label.split('\n');
  const widest = lines.reduce((most, line) => Math.max(most, line.length), 0);

  return { width: widest * CHAR_ADVANCE, height: lines.length * FONT_SIZE };
}

export function labelBox(label: string, kind: CanvasNodeKind): Box {
  if (kind === 'null') {
    return { width: DOT_DIAMETER, height: DOT_DIAMETER };
  }

  const text = textSize(label);

  if (kind === 'root' || kind === 'rootDegraded') {
    return { width: text.width + text.height, height: text.height * 2 };
  }

  if (kind === 'array') {
    const side = text.width + NODE_MARGIN * 2;

    return { width: side, height: side };
  }

  return { width: text.width + NODE_MARGIN * 2, height: text.height + NODE_MARGIN * 2 };
}

export function separation(left: Placed, right: Placed): number {
  const apart = Math.abs(left.x - right.x) - (left.box.width + right.box.width) / 2;
  const above = Math.abs(left.y - right.y) - (left.box.height + right.box.height) / 2;

  return Math.max(apart, above);
}

export function clears(left: Placed, right: Placed, gap: number): boolean {
  return separation(left, right) >= gap;
}
