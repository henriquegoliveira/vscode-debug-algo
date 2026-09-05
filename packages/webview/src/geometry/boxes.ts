export const FONT_SIZE = 14;
export const CHAR_ADVANCE = 8.4;
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

export function separation(left: Placed, right: Placed): number {
  const apart = Math.abs(left.x - right.x) - (left.box.width + right.box.width) / 2;
  const above = Math.abs(left.y - right.y) - (left.box.height + right.box.height) / 2;

  return Math.max(apart, above);
}
