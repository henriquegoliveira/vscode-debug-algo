import type { Options } from 'vis-network';
import type { LayoutKind } from '../model/layoutRule';
import { ARROW_SCALE, EDGE_WIDTH } from '../geometry/arrows';
import { BORDER_WIDTH } from '../model/graph/style';
import type { Drawn, PaintArgs } from './nodePainter';

export const PHYSICS_SPRING_LENGTH = 140;

export const PHYSICS_AVOID_OVERLAP = 0.3;

export const PHYSICS_GRAVITY = -8000;

export type NodePaint = (args: PaintArgs) => Drawn;

type EdgeSmooth = NonNullable<Options['edges']>['smooth'];

export const EDGE_OPTIONS: Options['edges'] = {
  font: { align: 'horizontal' },
  arrows: { to: { scaleFactor: ARROW_SCALE } },
  width: EDGE_WIDTH,
  selectionWidth: 1,
};

export function layoutOptions(kind: LayoutKind): Options {
  return {
    layout: { hierarchical: { enabled: false } },
    physics: physicsFor(kind),
    edges: { ...EDGE_OPTIONS, smooth: smoothFor(kind) },
  };
}

export function networkOptions(painter: NodePaint): Options {
  return {
    interaction: {
      hover: false,
      tooltipDelay: 0,
    },
    nodes: {
      borderWidth: BORDER_WIDTH,
      ctxRenderer: painter,
    } as Options['nodes'],
    edges: EDGE_OPTIONS,
  };
}

function physicsFor(kind: LayoutKind): Options['physics'] {
  if (kind === 'hierarchical') {
    return {
      enabled: true,
      solver: 'barnesHut',
      barnesHut: { springLength: 110, avoidOverlap: 0.4 },
    };
  }

  if (kind === 'physics') {
    return {
      enabled: true,
      solver: 'barnesHut',
      barnesHut: {
        springLength: PHYSICS_SPRING_LENGTH,
        avoidOverlap: PHYSICS_AVOID_OVERLAP,
        gravitationalConstant: PHYSICS_GRAVITY,
      },
    };
  }

  return { enabled: true, solver: 'barnesHut' };
}

function smoothFor(kind: LayoutKind): EdgeSmooth {
  if (kind === 'hierarchical') {
    return { enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.55 };
  }

  return false;
}
