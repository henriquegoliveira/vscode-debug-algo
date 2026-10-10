import { type TreeOrder, backDecision, declaredOrder } from '../geometry/treeLayout';
import type { GraphSnapshot, RecordNode, Value } from 'dbga-contract';

export interface Orientation {
  sides: Record<string, string[]>;
  back: string[];
}

export const EMPTY_ORIENTATION: Orientation = { sides: {}, back: [] };

type Key = number | string;

type Verdict = 'kept' | 'swapped';

export function keyOf(value: Value): Key | null {
  switch (value.t) {
    case 'int':
    case 'char':
    case 'enum':
    case 'real':
      return value.v;
    case 'text':
      return value.truncated ? null : value.v;
    default:
      return null;
  }
}

export function namedChildren(snapshot: GraphSnapshot, type: string, back: Set<string>): string[] {
  const observed = snapshot.meta.observedTypes.find((entry) => entry.type === type);
  if (observed === undefined) {
    return [];
  }

  const arrays = new Set<string>();
  snapshot.nodes.forEach((node) => {
    if (node.kind === 'record' && node.type === type) {
      node.arrays.forEach((array) => arrays.add(array.name));
    }
  });

  return observed.pointerFields.filter((field) => !back.has(field) && !arrays.has(field));
}

export function keySides(snapshot: GraphSnapshot, back: Set<string>): Map<string, string[]> {
  const records = new Map<string, RecordNode>();
  snapshot.nodes.forEach((node) => {
    if (node.kind === 'record') {
      records.set(node.id, node);
    }
  });

  const decided = new Map<string, string[]>();

  snapshot.meta.observedTypes.forEach(({ type }) => {
    const pair = namedChildren(snapshot, type, back);
    if (pair.length !== 2) {
      return;
    }

    const verdict = typeVerdict(snapshot, records, type, pair);
    if (verdict !== null) {
      decided.set(type, verdict === 'kept' ? pair : [pair[1], pair[0]]);
    }
  });

  return decided;
}

function typeVerdict(
  snapshot: GraphSnapshot,
  records: Map<string, RecordNode>,
  type: string,
  pair: string[],
): Verdict | null {
  const tallies = new Map<string, { less: number[]; more: number[] }>();

  snapshot.edges.forEach((edge) => {
    const side = pair.indexOf(edge.field);
    const parent = records.get(edge.from);
    const child = edge.to === null ? undefined : records.get(edge.to);

    if (side === -1 || parent?.type !== type || child?.type !== type) {
      return;
    }

    parent.fields.forEach((field) => {
      const mine = keyOf(field.value);
      const theirs = child.fields.find((other) => other.name === field.name);
      const other = theirs === undefined ? null : keyOf(theirs.value);

      if (mine === null || other === null || typeof mine !== typeof other || mine === other) {
        return;
      }

      let tally = tallies.get(field.name);
      if (tally === undefined) {
        tally = { less: [0, 0], more: [0, 0] };
        tallies.set(field.name, tally);
      }

      if (other < mine) {
        tally.less[side] += 1;
      } else {
        tally.more[side] += 1;
      }
    });
  });

  const verdicts = new Set<Verdict>();

  tallies.forEach(({ less, more }) => {
    if (less[0] > 0 && more[1] > 0 && more[0] === 0 && less[1] === 0) {
      verdicts.add('kept');
    } else if (less[1] > 0 && more[0] > 0 && more[1] === 0 && less[0] === 0) {
      verdicts.add('swapped');
    }
  });

  return verdicts.size === 1 ? ([...verdicts][0] as Verdict) : null;
}

export function foldOrientation(previous: Orientation, snapshot: GraphSnapshot): Orientation {
  const { back, reached } = backDecision(snapshot, previous.back);
  const fresh = reached.filter((field) => !previous.back.includes(field));
  const sides = { ...previous.sides };
  let changed = fresh.length > 0;

  keySides(snapshot, back).forEach((pair, type) => {
    if (sides[type] === undefined) {
      sides[type] = pair;
      changed = true;
    }
  });

  return changed ? { sides, back: [...previous.back, ...fresh] } : previous;
}

export function treeOrder(
  snapshot: GraphSnapshot,
  orientation: Orientation,
  mirrored: readonly string[],
): TreeOrder {
  const { back } = backDecision(snapshot, orientation.back);
  const declared = declaredOrder(snapshot, back);
  const fields = new Map<string, string[]>();

  declared.fields.forEach((order, type) => {
    const fixed = orientation.sides[type] ?? [];
    const ordered = [...fixed, ...order.filter((field) => !fixed.includes(field))];

    fields.set(type, mirrored.includes(type) ? ordered.reverse() : ordered);
  });

  return { fields, back };
}

export function childSides(snapshot: GraphSnapshot, order: TreeOrder, type: string): string[] {
  const named = namedChildren(snapshot, type, order.back);

  return (order.fields.get(type) ?? []).filter((field) => named.includes(field));
}
