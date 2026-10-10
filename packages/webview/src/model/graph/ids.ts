import type { Root } from 'dbga-contract';

const NODE_PREFIX = 'n:';

const TERMINAL_PREFIX = 't:';

const ROOT_PREFIX = 'r:';

const SEAT_PREFIX = 's:';

export const EDGE_PREFIX = 'e:';

export const ROOT_EDGE_PREFIX = 're:';

const CARD_PREFIX = 'c:';

export const NULL_FIELD = '@null';

export type CanvasSpace = 'node' | 'terminal' | 'root' | 'card';

export function nodeCanvasId(address: string): string {
  return `${NODE_PREFIX}${address}`;
}

export function terminalCanvasId(address: string): string {
  return `${TERMINAL_PREFIX}${address}`;
}

export function emptySeatId(address: string, field: string): string {
  return `${SEAT_PREFIX}${address}:${field}`;
}

export function rootKey(root: Root): string {
  return `${root.function}#${root.frameLevel}:${root.name}`;
}

export function rootCanvasId(root: Root): string {
  return `${ROOT_PREFIX}${rootKey(root)}`;
}

export function cardCanvasId(node: string): string {
  return `${CARD_PREFIX}${node}`;
}

export function frameKey(fn: string, level: number): string {
  return `${fn}#${level}`;
}

export function frameGroupKey(root: Root): string {
  return frameKey(root.function, root.frameLevel);
}

export function parseCanvasId(id: string): { space: CanvasSpace; address: string } | null {
  if (id.startsWith(NODE_PREFIX)) {
    return { space: 'node', address: id.slice(NODE_PREFIX.length) };
  }
  if (id.startsWith(TERMINAL_PREFIX)) {
    return { space: 'terminal', address: id.slice(TERMINAL_PREFIX.length) };
  }
  if (id.startsWith(ROOT_PREFIX)) {
    return { space: 'root', address: id.slice(ROOT_PREFIX.length) };
  }

  if (id.startsWith(CARD_PREFIX)) {
    return { space: 'card', address: id.slice(CARD_PREFIX.length) };
  }

  return null;
}
