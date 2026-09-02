import { frameGroupKey } from './ids';
import type { GraphSnapshot } from 'dbga-contract';

export function reachableNodes(snapshot: GraphSnapshot, frames: Set<string>): Set<string> {
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

  const walk = (seeds: string[]): Set<string> => {
    const seen = new Set<string>();
    const queue: string[] = [];

    seeds.forEach((seed) => {
      if (!seen.has(seed)) {
        seen.add(seed);
        queue.push(seed);
      }
    });

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      (outgoing.get(queue[cursor]) ?? []).forEach((to) => {
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      });
    }

    return seen;
  };

  const targets = (chosen?: Set<string>): string[] =>
    snapshot.roots
      .filter(
        (root) =>
          root.node !== null &&
          (chosen === undefined || root.origin === 'global' || chosen.has(frameGroupKey(root))),
      )
      .map((root) => root.node as string);

  const owned = walk(targets());
  const unowned = snapshot.nodes.filter((node) => !owned.has(node.id)).map((node) => node.id);

  return walk([...targets(frames), ...unowned]);
}

export function visibleSnapshot(snapshot: GraphSnapshot, frames?: Set<string>): GraphSnapshot {
  if (frames === undefined) {
    return snapshot;
  }

  const reachable = reachableNodes(snapshot, frames);
  if (reachable.size === snapshot.nodes.length) {
    return snapshot;
  }

  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => reachable.has(node.id)),
    edges: snapshot.edges.filter(
      (edge) => reachable.has(edge.from) && (edge.to === null || reachable.has(edge.to)),
    ),
  };
}

export function reciprocalPairs(snapshot: GraphSnapshot): Set<string> {
  const directed = new Set<string>();

  snapshot.edges.forEach((edge) => {
    if (edge.to !== null) {
      directed.add(`${edge.from} ${edge.to}`);
    }
  });

  const both = new Set<string>();
  directed.forEach((pair) => {
    const [from, to] = pair.split(' ');
    if (directed.has(`${to} ${from}`)) {
      both.add(pair);
    }
  });

  return both;
}
