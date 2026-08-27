import type { Options } from 'vis-network';
import type { GraphSnapshot } from 'dbga-contract';

export type LayoutKind = 'hierarchical' | 'physics' | 'default';

export function resolveLayout(snapshot: GraphSnapshot): LayoutKind {
  const hasPointerField = snapshot.meta.observedTypes.some((type) => type.pointerFields.length > 0);

  if (!hasPointerField) {
    return 'default';
  }

  return hasCycle(snapshot) ? 'physics' : 'hierarchical';
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
      layout: {
        hierarchical: {
          enabled: true,
          direction: 'UD',
          sortMethod: 'directed',
          shakeTowards: 'roots',
          levelSeparation: 130,
          nodeSpacing: 170,
          treeSpacing: 220,
        },
      },
      physics: { enabled: false },
    };
  }

  if (kind === 'physics') {
    return {
      layout: { hierarchical: { enabled: false } },
      physics: { enabled: true, solver: 'barnesHut', barnesHut: { springLength: 140 } },
    };
  }

  return {
    layout: { hierarchical: { enabled: false } },
    physics: { enabled: true, solver: 'barnesHut' },
  };
}
