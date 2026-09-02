import { CanvasNode } from '../model/graph/types';

export interface Seat {
  x: number;
  y: number;
}

export interface Trail {
  anchors: Map<string, Seat>;
  followers: Map<string, Seat>;
}

export function withoutSeat(node: CanvasNode): CanvasNode {
  const copy = { ...node };
  delete copy.x;
  delete copy.y;

  return copy;
}
