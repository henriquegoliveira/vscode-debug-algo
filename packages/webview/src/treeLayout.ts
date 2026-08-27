import type { GraphSnapshot } from 'dbga-contract';

export const LEVEL_SEPARATION = 140;
export const NODE_SPACING = 190;
export const COMPONENT_GAP = 120;

export interface TreePosition {
  x: number;
  y: number;
}

export interface StructuralForest {
  depth: Map<string, number>;
  children: Map<string, string[]>;
  roots: string[];
}

export function byField(left: string, right: string): number {
  const split = /^(.*?)(?:\[(\d+)\])?$/;
  const a = split.exec(left) as RegExpExecArray;
  const b = split.exec(right) as RegExpExecArray;

  if (a[1] !== b[1]) {
    return a[1] < b[1] ? -1 : 1;
  }

  return Number(a[2] ?? -1) - Number(b[2] ?? -1);
}

export function structuralForest(snapshot: GraphSnapshot): StructuralForest {
  const outgoing = new Map<string, { field: string; to: string }[]>();
  const indegree = new Map<string, number>();

  snapshot.nodes.forEach((node) => indegree.set(node.id, 0));

  snapshot.edges.forEach((edge) => {
    if (edge.to === null || !indegree.has(edge.from) || !indegree.has(edge.to)) {
      return;
    }

    const step = { field: edge.field, to: edge.to };
    const known = outgoing.get(edge.from);
    if (known === undefined) {
      outgoing.set(edge.from, [step]);
    } else {
      known.push(step);
    }

    indegree.set(edge.to, (indegree.get(edge.to) as number) + 1);
  });

  outgoing.forEach((steps) => steps.sort((a, b) => byField(a.field, b.field)));

  const ordered = snapshot.nodes.map((node) => node.id).sort();
  const depth = new Map<string, number>();
  const children = new Map<string, string[]>();
  const roots: string[] = [];

  const walk = (seed: string): void => {
    if (depth.has(seed)) {
      return;
    }

    roots.push(seed);
    depth.set(seed, 0);
    let frontier = [seed];

    while (frontier.length > 0) {
      const next: string[] = [];

      frontier.forEach((id) => {
        const level = depth.get(id) as number;

        (outgoing.get(id) ?? []).forEach((step) => {
          if (depth.has(step.to)) {
            return;
          }

          depth.set(step.to, level + 1);
          const kids = children.get(id);
          if (kids === undefined) {
            children.set(id, [step.to]);
          } else {
            kids.push(step.to);
          }

          next.push(step.to);
        });
      });

      frontier = next;
    }
  };

  ordered.forEach((id) => {
    if (indegree.get(id) === 0) {
      walk(id);
    }
  });

  ordered.forEach(walk);

  return { depth, children, roots };
}

export function structuralLevels(snapshot: GraphSnapshot): Map<string, number> {
  return structuralForest(snapshot).depth;
}

export function treePositions(snapshot: GraphSnapshot): Map<string, TreePosition> {
  const { depth, children, roots } = structuralForest(snapshot);
  const positions = new Map<string, TreePosition>();
  let cursor = 0;

  roots.forEach((root) => {
    const stack: { id: string; index: number }[] = [{ id: root, index: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const kids = children.get(frame.id) ?? [];

      if (frame.index < kids.length) {
        frame.index += 1;
        stack.push({ id: kids[frame.index - 1], index: 0 });
        continue;
      }

      const y = (depth.get(frame.id) as number) * LEVEL_SEPARATION;

      if (kids.length === 0) {
        positions.set(frame.id, { x: cursor, y });
        cursor += NODE_SPACING;
      } else {
        const first = positions.get(kids[0]) as TreePosition;
        const last = positions.get(kids[kids.length - 1]) as TreePosition;
        positions.set(frame.id, { x: (first.x + last.x) / 2, y });
      }

      stack.pop();
    }

    cursor += COMPONENT_GAP;
  });

  return positions;
}
