import { CanvasNode, DRIFT_TOLERANCE } from '../model/graph/types';

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

export function reseats(
  nodes: CanvasNode[],
  placed: Record<string, Seat>,
  authoritative: boolean,
  relayout: boolean,
): boolean {
  if (relayout) {
    return true;
  }

  if (!authoritative) {
    return false;
  }

  return nodes.some((node) => {
    if (node.x === undefined || node.y === undefined) {
      return false;
    }

    const at = placed[node.id];

    return at === undefined || Math.hypot(at.x - node.x, at.y - node.y) > DRIFT_TOLERANCE;
  });
}

export function seatPayload(
  nodes: CanvasNode[],
  placed: Record<string, Seat>,
  authoritative: boolean,
  relayout: boolean,
): CanvasNode[] {
  const reseat = reseats(nodes, placed, authoritative, relayout);

  return nodes.map((node) => {
    if (node.x === undefined || node.y === undefined || reseat) {
      return node;
    }

    return placed[node.id] === undefined ? node : withoutSeat(node);
  });
}
