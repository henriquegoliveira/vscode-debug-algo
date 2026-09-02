import type { GraphSnapshot } from 'dbga-contract';
import { BOX_GAP, LEVEL_GAP, type Box } from './boxes';

export const LEVEL_SEPARATION = 140;
export const NODE_SPACING = 190;
export const COMPONENT_GAP = 120;
export const REPAIR_ROUNDS = 12;

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

export function baseField(field: string): string {
  const open = field.indexOf('[');

  return open === -1 ? field : field.slice(0, open);
}

export function backFields(snapshot: GraphSnapshot): Set<string> {
  const byPair = new Map<string, string[]>();

  snapshot.edges.forEach((edge) => {
    if (edge.to === null) {
      return;
    }

    const key = `${edge.from} ${edge.to}`;
    const known = byPair.get(key);
    if (known === undefined) {
      byPair.set(key, [baseField(edge.field)]);
    } else if (!known.includes(baseField(edge.field))) {
      known.push(baseField(edge.field));
    }
  });

  const partners = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    const known = partners.get(a);
    if (known === undefined) {
      partners.set(a, new Set([b]));
    } else {
      known.add(b);
    }
  };

  byPair.forEach((fields, key) => {
    const [from, to] = key.split(' ');
    const reverse = byPair.get(`${to} ${from}`);
    if (reverse === undefined) {
      return;
    }

    fields.forEach((field) => reverse.forEach((other) => link(field, other)));
  });

  const back = new Set<string>();

  for (;;) {
    let chosen: string | null = null;
    let best = 0;

    partners.forEach((others, field) => {
      if (back.has(field)) {
        return;
      }

      const live = [...others].filter((other) => !back.has(other) && other !== field).length;
      if (live > best || (live === best && live > 0 && (chosen === null || field < chosen))) {
        chosen = field;
        best = live;
      }
    });

    if (chosen === null) {
      return back;
    }

    back.add(chosen);
  }
}

export function structuralForest(snapshot: GraphSnapshot): StructuralForest {
  const outgoing = new Map<string, { field: string; to: string }[]>();
  const indegree = new Map<string, number>();
  const back = backFields(snapshot);

  snapshot.nodes.forEach((node) => indegree.set(node.id, 0));

  snapshot.edges.forEach((edge) => {
    if (edge.to === null || !indegree.has(edge.from) || !indegree.has(edge.to)) {
      return;
    }

    if (back.has(baseField(edge.field))) {
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

export function levelRows(
  depth: Map<string, number>,
  sizes: Map<string, Box> | undefined,
): Map<number, number> {
  const tallest = new Map<number, number>();

  depth.forEach((level, id) => {
    const height = sizes?.get(id)?.height ?? LEVEL_SEPARATION - LEVEL_GAP;

    tallest.set(level, Math.max(tallest.get(level) ?? 0, height));
  });

  const rows = new Map<number, number>();
  const ordered = [...tallest.keys()].sort((left, right) => left - right);

  let cursor = 0;
  let previous = 0;

  ordered.forEach((level, index) => {
    const height = tallest.get(level) as number;

    if (index > 0) {
      cursor += Math.max(previous / 2 + height / 2 + LEVEL_GAP, LEVEL_SEPARATION);
    }

    rows.set(level, cursor);
    previous = height;
  });

  return rows;
}

export function treePositions(
  snapshot: GraphSnapshot,
  sizes?: Map<string, Box>,
): Map<string, TreePosition> {
  const { depth, children, roots } = structuralForest(snapshot);
  const positions = new Map<string, TreePosition>();
  const rows = levelRows(depth, sizes);
  const halfOf = (id: string): number => (sizes?.get(id)?.width ?? NODE_SPACING - BOX_GAP) / 2;

  let cursor = 0;
  let last: number | null = null;

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

      const y = rows.get(depth.get(frame.id) as number) as number;

      if (kids.length === 0) {
        const half = halfOf(frame.id);
        const x = last === null ? cursor + half : Math.max(cursor + half, last + NODE_SPACING);

        positions.set(frame.id, { x, y });
        cursor = x + half + BOX_GAP;
        last = x;
      } else {
        const first = positions.get(kids[0]) as TreePosition;
        const tail = positions.get(kids[kids.length - 1]) as TreePosition;

        positions.set(frame.id, { x: (first.x + tail.x) / 2, y });
      }

      stack.pop();
    }

    cursor += COMPONENT_GAP;
    last = null;
  });

  return repair(positions, depth, children, halfOf);
}

function repair(
  positions: Map<string, TreePosition>,
  depth: Map<string, number>,
  children: Map<string, string[]>,
  halfOf: (id: string) => number,
): Map<string, TreePosition> {
  const byLevel = new Map<number, string[]>();

  positions.forEach((_, id) => {
    const level = depth.get(id) as number;
    const row = byLevel.get(level);

    if (row === undefined) {
      byLevel.set(level, [id]);
    } else {
      row.push(id);
    }
  });

  const deepest = [...positions.keys()].sort((left, right) => {
    const gap = (depth.get(right) as number) - (depth.get(left) as number);

    return gap !== 0 ? gap : left < right ? -1 : 1;
  });

  for (let round = 0; round < REPAIR_ROUNDS; round += 1) {
    let moved = false;

    byLevel.forEach((row) => {
      const ordered = [...row].sort((left, right) => {
        const gap =
          (positions.get(left) as TreePosition).x - (positions.get(right) as TreePosition).x;

        return gap !== 0 ? gap : left < right ? -1 : 1;
      });

      let edge = Number.NEGATIVE_INFINITY;

      ordered.forEach((id) => {
        const at = positions.get(id) as TreePosition;
        const half = halfOf(id);
        const wanted = Math.max(at.x, edge + half);

        if (wanted > at.x) {
          positions.set(id, { x: wanted, y: at.y });
          moved = true;
        }

        edge = wanted + half + BOX_GAP;
      });
    });

    deepest.forEach((id) => {
      const kids = children.get(id) ?? [];

      if (kids.length === 0) {
        return;
      }

      const at = positions.get(id) as TreePosition;
      const first = positions.get(kids[0]) as TreePosition;
      const tail = positions.get(kids[kids.length - 1]) as TreePosition;
      const wanted = (first.x + tail.x) / 2;

      if (wanted > at.x) {
        positions.set(id, { x: wanted, y: at.y });
        moved = true;
      }
    });

    if (!moved) {
      break;
    }
  }

  return positions;
}
