import { type Box, type Placed, separation } from './boxes';
import type { TreePosition } from './treeLayout';
import type { GraphSnapshot } from 'dbga-contract';

export const ROOT_RADIUS = 210;

export const ROOT_SPREAD = 20;

export const ROOT_BASE_ANGLE = 210;

export const ROOT_GAP = 60;

export const ORBIT_STEPS = 19;

export const ORBIT_RINGS = [1, 1.45, 1.9, 2.35, 2.8];

export function wedgeAngles(
  snapshot: GraphSnapshot,
  seats: Map<string, TreePosition>,
): Map<string, number> {
  const neighbours = new Map<string, Set<string>>();

  const link = (from: string, to: string): void => {
    const known = neighbours.get(from);
    if (known === undefined) {
      neighbours.set(from, new Set([to]));
    } else {
      known.add(to);
    }
  };

  snapshot.edges.forEach((edge) => {
    if (edge.to === null || edge.to === edge.from) {
      return;
    }

    link(edge.from, edge.to);
    link(edge.to, edge.from);
  });

  const angles = new Map<string, number>();

  seats.forEach((seat, id) => {
    const around: number[] = [];

    (neighbours.get(id) ?? new Set<string>()).forEach((other) => {
      const at = seats.get(other);
      if (at === undefined || (at.x === seat.x && at.y === seat.y)) {
        return;
      }

      around.push(degrees(Math.atan2(at.y - seat.y, at.x - seat.x)));
    });

    if (around.length === 0) {
      return;
    }

    around.sort((a, b) => a - b);

    let widest = -1;
    let middle = ROOT_BASE_ANGLE;

    around.forEach((angle, position) => {
      const next = position + 1 < around.length ? around[position + 1] : around[0] + 360;
      const gap = next - angle;

      if (gap > widest) {
        widest = gap;
        middle = angle + gap / 2;
      }
    });

    angles.set(id, ((middle % 360) + 360) % 360);
  });

  return angles;
}

export function orbitSeat(
  seat: TreePosition | undefined,
  rank: number,
  occupied: Placed[] = [],
  base: number = ROOT_BASE_ANGLE,
  box: Box = { width: ROOT_GAP, height: ROOT_GAP },
): TreePosition | undefined {
  if (seat === undefined) {
    return undefined;
  }

  let best: TreePosition | undefined;
  let widest = Number.NEGATIVE_INFINITY;

  for (const ring of ORBIT_RINGS) {
    for (let step = 0; step < ORBIT_STEPS; step += 1) {
      const angle = ((base + alternate(rank + step) * ROOT_SPREAD) * Math.PI) / 180;
      const at = {
        x: seat.x + ROOT_RADIUS * ring * Math.cos(angle),
        y: seat.y + ROOT_RADIUS * ring * Math.sin(angle),
      };

      const clearance = occupied.reduce(
        (least, other) => Math.min(least, separation({ ...at, box }, other)),
        Number.POSITIVE_INFINITY,
      );

      if (clearance >= ROOT_GAP) {
        return at;
      }

      if (clearance > widest) {
        widest = clearance;
        best = at;
      }
    }
  }

  return best;
}

export function alternate(step: number): number {
  const turn = Math.ceil(step / 2);

  return step % 2 === 0 ? turn : -turn;
}

function degrees(radians: number): number {
  return ((((radians * 180) / Math.PI) % 360) + 360) % 360;
}
