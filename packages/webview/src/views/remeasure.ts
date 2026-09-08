import type { Network } from 'vis-network';

interface Sized {
  needsRefresh: () => void;
}

interface Internals {
  body?: { nodes?: Record<string, Sized> };
}

export function remeasureNodes(network: Network): void {
  const nodes = (network as unknown as Internals).body?.nodes;

  if (nodes === undefined) {
    return;
  }

  Object.keys(nodes).forEach((id) => nodes[id].needsRefresh());
  network.redraw();
}
