import type { GraphSnapshot } from 'dbga-contract';
import { backFields, baseField } from '../geometry/treeLayout';
import { EMPTY_ORIENTATION, type Orientation } from './orientation';

export type LayoutKind = 'hierarchical' | 'physics' | 'default';

export type LayoutChoice = 'auto' | 'physics' | 'hierarchical';

export const DEFAULT_CHOICE: LayoutChoice = 'auto';

export const LAYOUT_RANK: Record<LayoutKind, number> = {
  default: 0,
  physics: 1,
  hierarchical: 2,
};

export function promotes(from: LayoutKind, to: LayoutKind): boolean {
  return LAYOUT_RANK[to] > LAYOUT_RANK[from];
}

export function layoutForChoice(
  choice: LayoutChoice,
  snapshot: GraphSnapshot,
  orientation: Orientation = EMPTY_ORIENTATION,
): LayoutKind {
  return choice === 'auto' ? resolveLayout(snapshot, orientation) : choice;
}

export function resolveLayout(
  snapshot: GraphSnapshot,
  orientation: Orientation = EMPTY_ORIENTATION,
): LayoutKind {
  const hasPointerField = snapshot.meta.observedTypes.some((type) => type.pointerFields.length > 0);

  if (!hasPointerField) {
    return 'default';
  }

  return forwardDegree(snapshot, orientation) >= 2 ? 'hierarchical' : 'physics';
}

export function forwardDegree(
  snapshot: GraphSnapshot,
  orientation: Orientation = EMPTY_ORIENTATION,
): number {
  const back = backFields(snapshot, orientation.back);
  const degree = new Map<string, number>();

  snapshot.edges.forEach((edge) => {
    if (edge.to === null || back.has(baseField(edge.field))) {
      return;
    }

    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
  });

  let most = 0;
  degree.forEach((value) => {
    if (value > most) {
      most = value;
    }
  });

  return most;
}
