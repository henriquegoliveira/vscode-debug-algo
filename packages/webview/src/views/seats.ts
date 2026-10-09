import type { Seat } from '../geometry/motion';
import type { CanvasNode } from '../model/graph/types';

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

export function seatMap(nodes: CanvasNode[]): Map<string, Seat> {
  const seats = new Map<string, Seat>();

  nodes.forEach((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      seats.set(node.id, { x: node.x, y: node.y });
    }
  });

  return seats;
}

export function parentOf(edges: { from: string; to: string }[]): Map<string, string> {
  const parents = new Map<string, string>();

  edges.forEach((edge) => {
    if (!parents.has(edge.to)) {
      parents.set(edge.to, edge.from);
    }
  });

  return parents;
}

export function seatPayload(
  nodes: CanvasNode[],
  seats: Map<string, Seat>,
  placed: Record<string, Seat>,
  authoritative: boolean,
): CanvasNode[] {
  return nodes.map((node) => {
    if (!authoritative) {
      return placed[node.id] === undefined ? node : withoutSeat(node);
    }

    const at = seats.get(node.id);

    return at === undefined ? node : { ...node, x: at.x, y: at.y };
  });
}
