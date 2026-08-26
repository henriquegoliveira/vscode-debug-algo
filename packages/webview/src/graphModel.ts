import type { GraphNode, GraphSnapshot, Root } from 'dbga-contract';
import { formatValue } from './format';

const NODE_PREFIX = 'n:';
const TERMINAL_PREFIX = 't:';
const ROOT_PREFIX = 'r:';
const EDGE_PREFIX = 'e:';
const ROOT_EDGE_PREFIX = 're:';
const NULL_FIELD = '@null';

const MAX_LABEL_ENTRIES = 4;
const MAX_CELL_PREVIEW = 3;

export type CanvasNodeKind = 'record' | 'array' | 'opaque' | 'null' | 'root' | 'rootDegraded';

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  label: string;
  shape: string;
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
  font: { color: string; strokeWidth: number; face: string };
}

export interface FrameRoot {
  id: string;
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

const MONOSPACE = 'monospace';

const NODE_STYLE: Record<
  CanvasNodeKind,
  { shape: string; background: string; border: string; text: string }
> = {
  record: { shape: 'box', background: '#4ec9b0', border: '#2d7d6c', text: '#101010' },
  array: { shape: 'database', background: '#c586c0', border: '#7d5279', text: '#101010' },
  opaque: { shape: 'box', background: '#5a5a5a', border: '#8a8a8a', text: '#e0e0e0' },
  null: { shape: 'dot', background: '#3a3a3a', border: '#8a8a8a', text: '#c0c0c0' },
  root: { shape: 'ellipse', background: '#569cd6', border: '#2f6ea8', text: '#101010' },
  rootDegraded: { shape: 'ellipse', background: '#4a4a4a', border: '#ce9178', text: '#ce9178' },
};

const EDGE_COLOR = '#9a9a9a';
const EDGE_ROOT_COLOR = '#569cd6';
const EDGE_LABEL_COLOR = '#d4d4d4';

export function toGraph(snapshot: GraphSnapshot): GraphModel {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  snapshot.nodes.forEach((node) => nodes.push(canvasNode(node)));

  const nullFieldsByOrigin = new Map<string, string[]>();

  snapshot.edges.forEach((edge) => {
    if (edge.to === null) {
      const pending = nullFieldsByOrigin.get(edge.from);
      if (pending === undefined) {
        nullFieldsByOrigin.set(edge.from, [edge.field]);
      } else {
        pending.push(edge.field);
      }
      return;
    }

    edges.push({
      id: `${EDGE_PREFIX}${edge.from}:${edge.field}`,
      from: `${NODE_PREFIX}${edge.from}`,
      to: `${NODE_PREFIX}${edge.to}`,
      label: edge.field,
      arrows: 'to',
      dashes: false,
      color: { color: EDGE_COLOR },
      font: { color: EDGE_LABEL_COLOR, strokeWidth: 0, face: MONOSPACE },
    });
  });

  nullFieldsByOrigin.forEach((fields, from) => {
    nodes.push(styled(`${TERMINAL_PREFIX}${from}`, 'null', 'NULL'));
    edges.push({
      id: `${EDGE_PREFIX}${from}:${NULL_FIELD}`,
      from: `${NODE_PREFIX}${from}`,
      to: `${TERMINAL_PREFIX}${from}`,
      label: fields.join(', '),
      arrows: 'to',
      dashes: true,
      color: { color: EDGE_COLOR },
      font: { color: EDGE_LABEL_COLOR, strokeWidth: 0, face: MONOSPACE },
    });
  });

  const frames: FrameGroup[] = [];
  const frameIndex = new Map<string, FrameGroup>();

  snapshot.roots.forEach((root) => {
    const id = rootId(root);

    if (root.node !== null) {
      nodes.push(styled(id, root.status === 'ok' ? 'root' : 'rootDegraded', rootLabel(root)));
      edges.push({
        id: `${ROOT_EDGE_PREFIX}${id}`,
        from: id,
        to: `${NODE_PREFIX}${root.node}`,
        label: root.status === 'ok' ? '' : root.status,
        arrows: 'to',
        dashes: root.status !== 'ok',
        color: { color: EDGE_ROOT_COLOR },
        font: { color: EDGE_LABEL_COLOR, strokeWidth: 0, face: MONOSPACE },
      });
      return;
    }

    const key = frameKey(root);
    let group = frameIndex.get(key);
    if (group === undefined) {
      group = { id: key, function: root.function, frameLevel: root.frameLevel, roots: [] };
      frameIndex.set(key, group);
      frames.push(group);
    }

    group.roots.push({
      id,
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

function rootId(root: Root): string {
  return `${ROOT_PREFIX}${frameKey(root)}:${root.name}`;
}

function frameKey(root: Root): string {
  return `${root.function}#${root.frameLevel}`;
}

function rootLabel(root: Root): string {
  return `${root.name}\n${root.function} #${root.frameLevel}`;
}

function canvasNode(node: GraphNode): CanvasNode {
  if (node.kind === 'record') {
    return styled(`${NODE_PREFIX}${node.id}`, 'record', recordLabel(node));
  }

  if (node.kind === 'array') {
    return styled(`${NODE_PREFIX}${node.id}`, 'array', arrayLabel(node));
  }

  return styled(`${NODE_PREFIX}${node.id}`, 'opaque', opaqueLabel(node));
}

function recordLabel(node: Extract<GraphNode, { kind: 'record' }>): string {
  const entries = [
    ...node.fields.map((field) => `${field.name} = ${formatValue(field.value)}`),
    ...node.arrays.map((array) => `${array.name}[${array.length}]`),
  ];

  return withEntries(node.type, entries);
}

function arrayLabel(node: Extract<GraphNode, { kind: 'array' }>): string {
  if (node.cellsArePointers) {
    return node.type;
  }

  const preview = node.cells.slice(0, MAX_CELL_PREVIEW).map(formatValue).join(', ');
  const rest = node.cells.length > MAX_CELL_PREVIEW ? ', …' : '';

  return `${node.type}\n${preview}${rest}`;
}

function opaqueLabel(node: Extract<GraphNode, { kind: 'opaque' }>): string {
  const declared = node.type ?? null;

  return declared === null ? `<${node.reason}>` : `${declared}\n<${node.reason}>`;
}

function withEntries(head: string, entries: string[]): string {
  const shown = entries.slice(0, MAX_LABEL_ENTRIES);
  const hidden = entries.length - shown.length;
  const tail = hidden > 0 ? [`+${hidden}`] : [];

  return [head, ...shown, ...tail].join('\n');
}

function styled(id: string, kind: CanvasNodeKind, label: string): CanvasNode {
  const style = NODE_STYLE[kind];

  return {
    id,
    kind,
    label,
    shape: style.shape,
    color: { background: style.background, border: style.border },
    font: { color: style.text, face: MONOSPACE },
  };
}
