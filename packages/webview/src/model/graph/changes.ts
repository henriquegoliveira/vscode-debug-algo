import { ChangeKind } from '../../ui/theme';
import { EDGE_PREFIX, nodeCanvasId } from './ids';
import { unique } from './labels';
import type { CanvasEdge, NodeChanges, Pass } from './types';
import type { GraphNode, GraphSnapshot } from 'dbga-contract';

export function changedNodes(previous: GraphSnapshot, next: GraphSnapshot): NodeChanges {
  const alive = new Set(next.nodes.map((node) => node.id));
  const before = new Set(previous.nodes.map((node) => node.id));

  const created = next.nodes.filter((node) => !before.has(node.id)).map((node) => node.id);
  const isNew = new Set(created);

  const wasLinked = edgeTargets(previous);
  const nowLinked = edgeTargets(next);

  const relinked = new Set<string>();
  const touched = new Set<string>();
  const destinations: Record<string, string[]> = {};

  const note = (key: string, to: string | null | undefined): void => {
    const from = edgeOrigin(key);

    if (!alive.has(from) || isNew.has(from)) {
      return;
    }

    relinked.add(from);
    touched.add(`${from}:${key.slice(from.length + 1)}`);

    if (to === null || to === undefined || !alive.has(to)) {
      return;
    }

    const known = destinations[from];
    if (known === undefined) {
      destinations[from] = [to];
    } else if (!known.includes(to)) {
      known.push(to);
    }
  };

  nowLinked.forEach((to, key) => {
    if (wasLinked.get(key) !== to) {
      note(key, to);
    }
  });

  wasLinked.forEach((to, key) => {
    if (!nowLinked.has(key)) {
      note(key, undefined);
    }
  });

  const fingerprints = new Map(previous.nodes.map((node) => [node.id, valueFingerprint(node)]));

  const valued = next.nodes
    .filter(
      (node) =>
        !isNew.has(node.id) &&
        !relinked.has(node.id) &&
        fingerprints.get(node.id) !== valueFingerprint(node),
    )
    .map((node) => node.id);

  return { created, relinked: [...relinked], valued, destinations, edges: [...touched] };
}

export function changeHighlight(pass: Pass, of: GraphSnapshot | null): Map<string, ChangeKind> {
  const marks = new Map<string, ChangeKind>();

  if (pass.of !== of) {
    return marks;
  }

  pass.changes.valued.forEach((id) => marks.set(id, 'valued'));
  pass.changes.relinked.forEach((id) => {
    marks.set(id, 'relinked');
    (pass.changes.destinations[id] ?? []).forEach((other) => {
      if (!marks.has(other)) {
        marks.set(other, 'relinked');
      }
    });
  });
  pass.changes.created.forEach((id) => marks.set(id, 'created'));

  return marks;
}

export function changedEdges(changes: NodeChanges, edges: CanvasEdge[]): CanvasEdge[] {
  const wanted = new Set(changes.edges.map((key) => `${EDGE_PREFIX}${key}`));

  return edges.filter((edge) => wanted.has(edge.id));
}

export function focusTarget(
  snapshot: GraphSnapshot,
  changes: NodeChanges,
  drawn: Set<string>,
): string[] {
  const wanted: string[] = [];

  [changes.created, changes.relinked, changes.valued].forEach((bucket) =>
    bucket.forEach((id) => {
      wanted.push(id);
      (changes.destinations[id] ?? []).forEach((other) => wanted.push(other));
    }),
  );

  return unique(wanted.map(nodeCanvasId).filter((id) => drawn.has(id))).sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function edgeTargets(snapshot: GraphSnapshot): Map<string, string | null> {
  const targets = new Map<string, string | null>();

  snapshot.edges.forEach((edge) => targets.set(`${edge.from} ${edge.field}`, edge.to));

  return targets;
}

function edgeOrigin(key: string): string {
  return key.slice(0, key.indexOf(' '));
}

function valueFingerprint(node: GraphNode): string {
  if (node.kind === 'record') {
    return JSON.stringify([
      node.fields.map((field) => [field.name, field.value]),
      node.arrays.map((array) => [array.name, array.cells]),
    ]);
  }

  if (node.kind === 'array') {
    return JSON.stringify(node.cells);
  }

  return JSON.stringify(node.value ?? null);
}
