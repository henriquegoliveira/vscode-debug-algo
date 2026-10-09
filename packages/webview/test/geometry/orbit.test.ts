import { describe, expect, it } from 'vitest';
import { separation } from '../../src/geometry/boxes';
import {
  ROOT_GAP,
  UPPER_END,
  UPPER_START,
  alternate,
  orbitSeat,
  wedgeAngles,
} from '../../src/geometry/orbit';
import { treePositions } from '../../src/geometry/treeLayout';
import { binarySearchTreeSnapshot } from '../snapshots';

describe('wedgeAngles', () => {
  it('points every root card into the upper half-plane in a hierarchical layout', () => {
    const snapshot = binarySearchTreeSnapshot();
    const angles = wedgeAngles(snapshot, treePositions(snapshot), true);

    expect(angles.size).toBeGreaterThan(0);
    angles.forEach((angle) => {
      expect(angle).toBeGreaterThanOrEqual(UPPER_START);
      expect(angle).toBeLessThanOrEqual(UPPER_END);
    });
  });

  it('aims between the neighbours, away from the edges', () => {
    const snapshot = binarySearchTreeSnapshot();
    const seats = treePositions(snapshot);
    const root = snapshot.roots.find((candidate) => candidate.name === 'ptRoot')?.node as string;
    const angle = wedgeAngles(snapshot, seats)?.get(root) as number;

    expect(angle).toBeGreaterThan(180);
    expect(angle).toBeLessThan(360);
  });
});

describe('orbitSeat', () => {
  it('alternates around the base angle', () => {
    expect([0, 1, 2, 3, 4].map(alternate)).toEqual([0, -1, 1, -2, 2]);
  });

  it('finds a seat clear of the boxes already placed', () => {
    const box = { width: 80, height: 30 };
    const occupied = [{ x: 0, y: 0, box: { width: 120, height: 60 } }];
    const seat = orbitSeat({ x: 0, y: 0 }, 0, occupied, 270, box);

    expect(seat).toBeDefined();
    expect(
      separation({ ...(seat as { x: number; y: number }), box }, occupied[0]),
    ).toBeGreaterThanOrEqual(ROOT_GAP);
  });

  it('has no seat for a node that was not placed', () => {
    expect(orbitSeat(undefined, 0)).toBeUndefined();
  });
});
