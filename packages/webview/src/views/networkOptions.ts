import type { Options } from 'vis-network';
import type { LayoutKind } from '../model/layoutRule';
import { ARROW_SCALE } from '../geometry/arrows';

export const PHYSICS_SPRING_LENGTH = 140;

export const PHYSICS_AVOID_OVERLAP = 0.3;

export const PHYSICS_GRAVITY = -8000;

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
      physics: {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: {
          springLength: PHYSICS_SPRING_LENGTH,
          avoidOverlap: PHYSICS_AVOID_OVERLAP,
          gravitationalConstant: PHYSICS_GRAVITY,
        },
      },
      edges: { smooth: false },
    };
  }

  return {
    layout: { hierarchical: { enabled: false } },
    physics: { enabled: true, solver: 'barnesHut' },
    edges: { smooth: false },
  };
}

export const NETWORK_OPTIONS: Options = {
  interaction: {
    hover: false,
    tooltipDelay: 0,
  },
  nodes: {
    borderWidth: 1,
    margin: { top: 8, right: 10, bottom: 8, left: 10 },
  },
  edges: {
    font: { align: 'horizontal' },
    arrows: { to: { scaleFactor: ARROW_SCALE } },
    width: 1,
    selectionWidth: 1,
  },
};
