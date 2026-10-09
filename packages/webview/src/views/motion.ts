import { EDGE_WIDTH, arrowScale } from '../geometry/arrows';
import {
  MOTION_DURATION,
  type Motion,
  PULSE_DURATION,
  enterAlpha,
  pulseWidth,
  seatAt,
} from '../geometry/motion';
import type { CanvasEdge } from '../model/graph/types';
import type { DataSet } from 'vis-data';
import type { Edge, Network } from 'vis-network';

export interface MotionHandle {
  run: (plan: Motion[], marks: CanvasEdge[]) => void;
  stop: () => void;
  alphaOf: (id: string) => number;
}

export function createMotion(network: Network, edges: DataSet<Edge>): MotionHandle {
  const alphas = new Map<string, number>();

  let frame: number | null = null;
  let started = 0;
  let lead = MOTION_DURATION;
  let plan: Motion[] = [];
  let marks: CanvasEdge[] = [];

  const place = (progress: number): void => {
    plan.forEach((motion) => {
      const at = seatAt(motion, progress);

      network.moveNode(motion.id, at.x, at.y);

      if (motion.enter) {
        alphas.set(motion.id, enterAlpha(progress));
      }
    });
  };

  const throb = (progress: number): void => {
    const width = pulseWidth(progress);

    edges.update(
      marks.map((edge) => ({
        id: edge.id,
        width,
        arrows: { to: { enabled: true, scaleFactor: arrowScale(width) } },
      })) as Edge[],
    );
  };

  const restore = (): void => {
    edges.update(
      marks.map((edge) => ({
        id: edge.id,
        width: edge.width ?? EDGE_WIDTH,
        arrows: edge.arrows,
      })) as Edge[],
    );
  };

  const settle = (): void => {
    place(1);
    alphas.clear();

    if (marks.length > 0) {
      restore();
    }

    plan = [];
    marks = [];
    frame = null;
    network.redraw();
  };

  const step = (): void => {
    const now = performance.now() - started;

    if (now >= lead + PULSE_DURATION) {
      settle();
      return;
    }

    place(lead === 0 ? 1 : Math.min(now / lead, 1));

    if (now >= lead && marks.length > 0) {
      throb((now - lead) / PULSE_DURATION);
    }

    network.redraw();
    frame = window.requestAnimationFrame(step);
  };

  const cancel = (): void => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };

  return {
    run: (next, changed) => {
      cancel();
      alphas.clear();

      plan = next;
      marks = changed;

      if (plan.length === 0 && marks.length === 0) {
        return;
      }

      lead = plan.length === 0 ? 0 : MOTION_DURATION;
      started = performance.now();
      place(0);
      network.redraw();
      frame = window.requestAnimationFrame(step);
    },
    stop: () => {
      if (frame === null) {
        return;
      }

      cancel();
      settle();
    },
    alphaOf: (id) => alphas.get(id) ?? 1,
  };
}
