import type { ArrayNode, GraphSnapshot, Root, Value } from 'dbga-contract';
import { textSize } from '../geometry/boxes';
import { formatValue, valueKey } from './format';
import { frameGroupKey, nodeCanvasId, rootCanvasId } from './graph/ids';

export const CELL_GAP = 4;
export const CELL_PADDING = 12;
export const MIN_CELL_WIDTH = 34;
export const MAX_CELL_WIDTH = 220;

export interface Marker {
  id: string;
  name: string;
  function: string;
  frameLevel: number;
  origin: Root['origin'];
  index: number;
}

export interface Cell {
  index: number;
  value: Value;
  text: string;
  slot: string;
  changed: boolean;
}

export interface ArrayTrack {
  id: string;
  canvasId: string;
  key: string;
  names: string[];
  type: string;
  elementType: string;
  length: number;
  numeric: boolean;
  truncated: boolean;
  cells: Cell[];
  markers: Marker[];
  changed: Set<number>;
  cellWidth: number;
  step: number;
}

export interface SortingModel {
  tracks: ArrayTrack[];
}

const NUMERIC_KINDS = ['int', 'real', 'char'];

export function sortingModel(
  snapshot: GraphSnapshot,
  previous?: GraphSnapshot | null,
  frames?: Set<string>,
): SortingModel {
  const before = previous === null || previous === undefined ? null : trackKeys(previous);

  const tracks = arrayNodes(snapshot).map((node) => {
    const names = namesOf(snapshot, node.id);
    const key = names.length === 0 ? node.type : names.join('|');
    const numeric = node.cells.every((cell) => NUMERIC_KINDS.includes(cell.t));
    const changed = changedCells(before?.get(key), node.cells);
    const slots = slotsOf(key, node.cells);
    const markers = markersFor(snapshot, node, frames);
    const cellWidth = widthOf(node.cells);

    return {
      cellWidth,
      step: cellWidth + CELL_GAP,
      id: node.id,
      canvasId: nodeCanvasId(node.id),
      key,
      names,
      type: node.type,
      elementType: node.elementType,
      length: node.length,
      numeric,
      truncated: node.truncated,
      cells: node.cells.map((value, index) => ({
        index,
        value,
        text: formatValue(value),
        slot: slots[index],
        changed: changed.has(index),
      })),
      markers,
      changed,
    };
  });

  tracks.sort((left, right) =>
    left.length === right.length ? left.key.localeCompare(right.key) : right.length - left.length,
  );

  return { tracks };
}

export function defaultTracks(model: SortingModel): string[] {
  const first = model.tracks[0];

  return first === undefined ? [] : [first.key];
}

export function markersByIndex(track: ArrayTrack): Map<number, Marker[]> {
  const grouped = new Map<number, Marker[]>();

  track.markers.forEach((marker) => {
    const known = grouped.get(marker.index);
    if (known === undefined) {
      grouped.set(marker.index, [marker]);
    } else {
      known.push(marker);
    }
  });

  return grouped;
}

function arrayNodes(snapshot: GraphSnapshot): ArrayNode[] {
  return snapshot.nodes.filter((node): node is ArrayNode => node.kind === 'array');
}

function namesOf(snapshot: GraphSnapshot, id: string): string[] {
  const names = new Set<string>();

  snapshot.roots.forEach((root) => {
    if (root.node === id) {
      names.add(root.name);
    }
  });

  return [...names].sort();
}

function markersFor(snapshot: GraphSnapshot, node: ArrayNode, frames?: Set<string>): Marker[] {
  const markers: Marker[] = [];

  snapshot.roots.forEach((root) => {
    const value = root.value;
    if (
      !inFrames(root, frames) ||
      root.category !== 'scalar' ||
      value === null ||
      value === undefined ||
      value.t !== 'int' ||
      value.v < 0 ||
      value.v >= node.length
    ) {
      return;
    }

    markers.push({
      id: rootCanvasId(root),
      name: root.name,
      function: root.function,
      frameLevel: root.frameLevel,
      origin: root.origin,
      index: value.v,
    });
  });

  markers.sort((left, right) =>
    left.index === right.index
      ? left.frameLevel - right.frameLevel || left.name.localeCompare(right.name)
      : left.index - right.index,
  );

  return markers;
}

function inFrames(root: Root, frames: Set<string> | undefined): boolean {
  return frames === undefined || root.origin === 'global' || frames.has(frameGroupKey(root));
}

function widthOf(cells: Value[]): number {
  const widest = cells.reduce((most, cell) => Math.max(most, textSize(formatValue(cell)).width), 0);

  return Math.min(Math.max(Math.ceil(widest) + CELL_PADDING, MIN_CELL_WIDTH), MAX_CELL_WIDTH);
}

function trackKeys(snapshot: GraphSnapshot): Map<string, Value[]> {
  const keys = new Map<string, Value[]>();

  arrayNodes(snapshot).forEach((node) => {
    const names = namesOf(snapshot, node.id);
    keys.set(names.length === 0 ? node.type : names.join('|'), node.cells);
  });

  return keys;
}

function changedCells(before: Value[] | undefined, cells: Value[]): Set<number> {
  const changed = new Set<number>();

  if (before === undefined) {
    return changed;
  }

  cells.forEach((cell, index) => {
    const previous = before[index];
    if (previous === undefined || valueKey(previous) !== valueKey(cell)) {
      changed.add(index);
    }
  });

  return changed;
}

function slotsOf(key: string, cells: Value[]): string[] {
  const seen = new Map<string, number>();

  return cells.map((cell) => {
    const signature = valueKey(cell);
    const occurrence = seen.get(signature) ?? 0;
    seen.set(signature, occurrence + 1);

    return `${key}:${signature}:${occurrence}`;
  });
}
