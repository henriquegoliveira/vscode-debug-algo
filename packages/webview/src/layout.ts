import type { Options } from 'vis-network';
import type { GraphSnapshot } from 'dbga-contract';

export type LayoutKind = 'hierarchical' | 'physics' | 'default';

export type LayoutChoice = 'auto' | 'physics' | 'hierarchical';

export const DEFAULT_CHOICE: LayoutChoice = 'auto';

export function layoutForChoice(choice: LayoutChoice, snapshot: GraphSnapshot): LayoutKind {
  return choice === 'auto' ? resolveLayout(snapshot) : choice;
}

export function resolveLayout(snapshot: GraphSnapshot): LayoutKind {
  const hasPointerField = snapshot.meta.observedTypes.some((type) => type.pointerFields.length > 0);

  if (!hasPointerField) {
    return 'default';
  }

  if (hasCycle(snapshot)) {
    return 'physics';
  }

  return branches(snapshot) ? 'hierarchical' : 'physics';
}

export function maxOutDegree(snapshot: GraphSnapshot): number {
  const degree = new Map<string, number>();

  snapshot.edges.forEach((edge) => {
    if (edge.to === null) {
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

export function branches(snapshot: GraphSnapshot): boolean {
  const byType = snapshot.meta.observedTypes.some((type) => type.pointerFields.length >= 2);

  return byType || maxOutDegree(snapshot) >= 2;
}

export function hasCycle(snapshot: GraphSnapshot): boolean {
  const outgoing = new Map<string, string[]>();

  snapshot.edges.forEach((edge) => {
    if (edge.to === null) {
      return;
    }

    const known = outgoing.get(edge.from);
    if (known === undefined) {
      outgoing.set(edge.from, [edge.to]);
    } else {
      known.push(edge.to);
    }
  });

  const OPEN = 1;
  const CLOSED = 2;
  const marks = new Map<string, number>();

  for (const start of outgoing.keys()) {
    if (marks.has(start)) {
      continue;
    }

    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    marks.set(start, OPEN);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const children = outgoing.get(frame.id) ?? [];

      if (frame.next >= children.length) {
        marks.set(frame.id, CLOSED);
        stack.pop();
        continue;
      }

      const child = children[frame.next];
      frame.next += 1;

      const mark = marks.get(child);
      if (mark === OPEN) {
        return true;
      }
      if (mark === undefined) {
        marks.set(child, OPEN);
        stack.push({ id: child, next: 0 });
      }
    }
  }

  return false;
}

export function layoutOptions(kind: LayoutKind): Options {
  if (kind === 'hierarchical') {
    return {
      layout: { hierarchical: { enabled: false } },
      physics: {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: { springLength: 110, avoidOverlap: 0.4 },
      },
      edges: {
        smooth: { enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.55 },
      },
    };
  }

  if (kind === 'physics') {
    return {
      layout: { hierarchical: { enabled: false } },
      physics: { enabled: true, solver: 'barnesHut', barnesHut: { springLength: 140 } },
      edges: { smooth: false },
    };
  }

  return {
    layout: { hierarchical: { enabled: false } },
    physics: { enabled: true, solver: 'barnesHut' },
    edges: { smooth: false },
  };
}
