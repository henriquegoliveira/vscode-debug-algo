import type { GraphNode, GraphSnapshot, Root } from 'dbga-contract';
import type { TreePosition } from './treeLayout';
import { formatValue } from './format';
import { CanvasNodeKind, FALLBACK_THEME, Theme } from './theme';
import { structuralForest, structuralLevels, treePositions } from './treeLayout';

const NODE_PREFIX = 'n:';
const TERMINAL_PREFIX = 't:';
const ROOT_PREFIX = 'r:';
const EDGE_PREFIX = 'e:';
const ROOT_EDGE_PREFIX = 're:';
const NULL_FIELD = '@null';

const MAX_LABEL_ENTRIES = 2;
const MAX_CELL_PREVIEW = 2;

export type { CanvasNodeKind };

export type CanvasSpace = 'node' | 'terminal' | 'root';

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  label: string;
  shape: string;
  level?: number;
  x?: number;
  y?: number;
  fixed: boolean;
  physics: boolean;
  color: { background: string; border: string };
  font: { color: string; face: string };
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  arrows: 'to';
  dashes: boolean;
  color: { color: string };
  font: { color: string; size: number; strokeWidth: number; face: string; background: string };
}

export interface FrameRoot {
  id: string;
  canvasId: string | null;
  name: string;
  type: string;
  origin: Root['origin'];
  category: Root['category'];
  status: Root['status'];
  value: string;
}

export interface FrameGroup {
  id: string;
  function: string;
  frameLevel: number;
  roots: FrameRoot[];
}

export interface GraphModel {
  canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] };
  frames: FrameGroup[];
}

export interface GraphOptions {
  nullTerminals: boolean;
  pinned: boolean;
}

export const DEFAULT_OPTIONS: GraphOptions = { nullTerminals: false, pinned: false };

const ARRAY_CELLS = 'cells';
const NULL_MARK = 'NULL';

const NODE_SHAPE: Record<CanvasNodeKind, string> = {
  record: 'box',
  array: 'database',
  opaque: 'box',
  null: 'dot',
  root: 'ellipse',
  rootDegraded: 'ellipse',
};

export function nodeCanvasId(address: string): string {
  return `${NODE_PREFIX}${address}`;
}

export function terminalCanvasId(address: string): string {
  return `${TERMINAL_PREFIX}${address}`;
}

export function rootKey(root: Root): string {
  return `${root.function}#${root.frameLevel}:${root.name}`;
}

export function rootCanvasId(root: Root): string {
  return `${ROOT_PREFIX}${rootKey(root)}`;
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

  return null;
}

export { structuralForest, structuralLevels, treePositions };

export function toGraph(
  snapshot: GraphSnapshot,
  theme: Theme = FALLBACK_THEME,
  options: GraphOptions = DEFAULT_OPTIONS,
): GraphModel {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  const nullFieldsByOrigin = new Map<string, string[]>();

  snapshot.edges.forEach((edge) => {
    if (edge.to !== null) {
      return;
    }

    const pending = nullFieldsByOrigin.get(edge.from);
    if (pending === undefined) {
      nullFieldsByOrigin.set(edge.from, [edge.field]);
    } else {
      pending.push(edge.field);
    }
  });

  const levels = structuralLevels(snapshot);
  const pinned = options.pinned ? treePositions(snapshot) : null;

  snapshot.nodes.forEach((node) =>
    nodes.push(canvasNode(node, theme, levels.get(node.id), pinned?.get(node.id))),
  );

  snapshot.edges.forEach((edge) => {
    if (edge.to === null) {
      return;
    }

    edges.push({
      id: `${EDGE_PREFIX}${edge.from}:${edge.field}`,
      from: nodeCanvasId(edge.from),
      to: nodeCanvasId(edge.to),
      label: edge.field,
      arrows: 'to',
      dashes: false,
      color: { color: theme.edge.color },
      font: edgeFont(theme),
    });
  });

  if (options.nullTerminals) {
    nullFieldsByOrigin.forEach((fields, from) => {
      const origin = levels.get(from);

      nodes.push(
        styled(
          terminalCanvasId(from),
          'null',
          NULL_MARK,
          theme,
          origin === undefined ? undefined : origin + 1,
        ),
      );
      edges.push({
        id: `${EDGE_PREFIX}${from}:${NULL_FIELD}`,
        from: nodeCanvasId(from),
        to: terminalCanvasId(from),
        label: baseNames(fields).join(', '),
        arrows: 'to',
        dashes: true,
        color: { color: theme.edge.color },
        font: edgeFont(theme),
      });
    });
  }

  const frames: FrameGroup[] = [];
  const frameIndex = new Map<string, FrameGroup>();

  snapshot.roots.forEach((root) => {
    const id = rootCanvasId(root);
    const onCanvas = root.node !== null;

    if (onCanvas) {
      nodes.push(
        styled(
          id,
          root.status === 'ok' ? 'root' : 'rootDegraded',
          rootLabel(root),
          theme,
          levels.get(root.node as string),
        ),
      );
      edges.push({
        id: `${ROOT_EDGE_PREFIX}${id}`,
        from: id,
        to: nodeCanvasId(root.node as string),
        label: root.status === 'ok' ? '' : root.status,
        arrows: 'to',
        dashes: root.status !== 'ok',
        color: { color: theme.edge.rootColor },
        font: edgeFont(theme),
      });
    }

    const key = frameGroupKey(root);
    let group = frameIndex.get(key);
    if (group === undefined) {
      group = { id: key, function: root.function, frameLevel: root.frameLevel, roots: [] };
      frameIndex.set(key, group);
      frames.push(group);
    }

    group.roots.push({
      id,
      canvasId: onCanvas ? id : null,
      name: root.name,
      type: root.type,
      origin: root.origin,
      category: root.category,
      status: root.status,
      value: formatValue(root.value),
    });
  });

  frames.sort((a, b) => a.frameLevel - b.frameLevel);

  return { canvas: { nodes, edges }, frames };
}

function edgeFont(theme: Theme): CanvasEdge['font'] {
  return {
    color: theme.edge.label,
    size: 10,
    strokeWidth: 0,
    face: theme.fontFace,
    background: theme.edge.labelBackground,
  };
}

function baseNames(fields: string[]): string[] {
  const seen: string[] = [];

  fields.forEach((field) => {
    const open = field.indexOf('[');
    const base = open === -1 ? field : field.slice(0, open);
    const name = base === '' ? ARRAY_CELLS : base;

    if (!seen.includes(name)) {
      seen.push(name);
    }
  });

  return seen;
}

function frameGroupKey(root: Root): string {
  return `${root.function}#${root.frameLevel}`;
}

function rootLabel(root: Root): string {
  return `${root.name}\n${root.function} #${root.frameLevel}`;
}

function canvasNode(
  node: GraphNode,
  theme: Theme,
  level: number | undefined,
  seat: TreePosition | undefined,
): CanvasNode {
  const kind = node.kind === 'record' ? 'record' : node.kind === 'array' ? 'array' : 'opaque';
  const label =
    node.kind === 'record'
      ? recordLabel(node)
      : node.kind === 'array'
        ? arrayLabel(node)
        : opaqueLabel(node);

  return styled(nodeCanvasId(node.id), kind, label, theme, level, seat);
}

function recordLabel(node: Extract<GraphNode, { kind: 'record' }>): string {
  const entries = node.fields.map((field) => `${field.name} = ${formatValue(field.value)}`);
  const shown = entries.slice(0, MAX_LABEL_ENTRIES);
  const hidden = entries.length - shown.length + node.arrays.length;

  return join(node.type, shown, hidden);
}

function arrayLabel(node: Extract<GraphNode, { kind: 'array' }>): string {
  if (node.cellsArePointers) {
    return join(node.type, [], 0);
  }

  const shown = node.cells.slice(0, MAX_CELL_PREVIEW).map(formatValue);

  return join(node.type, [shown.join(', ')], node.cells.length - shown.length);
}

function opaqueLabel(node: Extract<GraphNode, { kind: 'opaque' }>): string {
  const declared = node.type ?? null;

  return declared === null ? `<${node.reason}>` : `${declared}\n<${node.reason}>`;
}

function join(head: string, shown: string[], hidden: number): string {
  const tail = hidden > 0 ? [`+${hidden}`] : [];

  return [head, ...shown, ...tail].join('\n');
}

function styled(
  id: string,
  kind: CanvasNodeKind,
  label: string,
  theme: Theme,
  level?: number,
  seat?: TreePosition,
): CanvasNode {
  const palette = theme.nodes[kind];
  const node: CanvasNode = {
    id,
    kind,
    label,
    shape: NODE_SHAPE[kind],
    fixed: seat !== undefined,
    physics: seat === undefined,
    color: { background: palette.background, border: palette.border },
    font: { color: palette.text, face: theme.fontFace },
  };

  if (level !== undefined) {
    node.level = level;
  }

  if (seat !== undefined) {
    node.x = seat.x;
    node.y = seat.y;
  }

  return node;
}
