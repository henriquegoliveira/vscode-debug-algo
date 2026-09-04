import type { GraphSnapshot } from 'dbga-contract';
import { backFields, baseField } from '../geometry/treeLayout';

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

export function layoutForChoice(choice: LayoutChoice, snapshot: GraphSnapshot): LayoutKind {
  return choice === 'auto' ? resolveLayout(snapshot) : choice;
}

export function resolveLayout(snapshot: GraphSnapshot): LayoutKind {
  const hasPointerField = snapshot.meta.observedTypes.some((type) => type.pointerFields.length > 0);

  if (!hasPointerField) {
    return 'default';
  }

  return forwardDegree(snapshot) >= 2 ? 'hierarchical' : 'physics';
}

export function forwardDegree(snapshot: GraphSnapshot): number {
  const back = backFields(snapshot);
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
