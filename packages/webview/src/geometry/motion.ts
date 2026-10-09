import { HIGHLIGHT_WIDTH } from './arrows';
import { easeInOutQuad } from './camera';

export const MOTION_DURATION = 420;

export const ENTER_SHARE = 0.55;

export const MOTION_EPSILON = 0.5;

export const PULSE_DURATION = 880;

export const PULSE_CYCLES = 2;

export const PULSE_GAIN = 3;

export interface Seat {
  x: number;
  y: number;
}

export interface Motion {
  id: string;
  from: Seat;
  to: Seat;
  enter: boolean;
}

export function planMotion(
  targets: Map<string, Seat>,
  placed: Map<string, Seat>,
  origin: (id: string) => string | undefined,
): Motion[] {
  const plan: Motion[] = [];

  targets.forEach((to, id) => {
    const at = placed.get(id);

    if (at !== undefined) {
      if (Math.hypot(to.x - at.x, to.y - at.y) > MOTION_EPSILON) {
        plan.push({ id, from: at, to, enter: false });
      }

      return;
    }

    const parent = origin(id);
    const start = parent === undefined ? to : (placed.get(parent) ?? targets.get(parent) ?? to);

    plan.push({ id, from: start, to, enter: true });
  });

  return plan;
}

export function seatAt(motion: Motion, progress: number): Seat {
  const eased = easeInOutQuad(progress);

  return {
    x: motion.from.x + (motion.to.x - motion.from.x) * eased,
    y: motion.from.y + (motion.to.y - motion.from.y) * eased,
  };
}

export function enterAlpha(progress: number): number {
  return Math.min(Math.max(progress / ENTER_SHARE, 0), 1);
}

export function pulseWidth(progress: number): number {
  const t = Math.min(Math.max(progress, 0), 1);
  const wave = (1 - Math.cos(2 * Math.PI * PULSE_CYCLES * t)) / 2;

  return HIGHLIGHT_WIDTH + PULSE_GAIN * (1 - t) * wave;
}

export const ORIGIN: Seat = { x: 0, y: 0 };

export function anchorShift(targets: Map<string, Seat>, previous: Map<string, Seat>): Seat {
  const tally = new Map<string, { at: Seat; weight: number }>();

  targets.forEach((at, id) => {
    const was = previous.get(id);

    if (was === undefined) {
      return;
    }

    const shift = { x: was.x - at.x, y: was.y - at.y };
    const key = `${Math.round(shift.x)}:${Math.round(shift.y)}`;
    const known = tally.get(key);

    if (known === undefined) {
      tally.set(key, { at: shift, weight: 1 });
    } else {
      known.weight += 1;
    }
  });

  let best = { at: ORIGIN, weight: 0 };

  tally.forEach((entry) => {
    if (entry.weight > best.weight || (entry.weight === best.weight && nearer(entry.at, best.at))) {
      best = entry;
    }
  });

  return best.at;
}

export function shiftSeats(targets: Map<string, Seat>, by: Seat): Map<string, Seat> {
  if (by.x === 0 && by.y === 0) {
    return targets;
  }

  const moved = new Map<string, Seat>();

  targets.forEach((at, id) => moved.set(id, { x: at.x + by.x, y: at.y + by.y }));

  return moved;
}

function nearer(candidate: Seat, best: Seat): boolean {
  return Math.hypot(candidate.x, candidate.y) < Math.hypot(best.x, best.y);
}
