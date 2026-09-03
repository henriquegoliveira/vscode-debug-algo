import type {
  ExtractionError,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  Root,
  Value,
} from 'dbga-contract';
import { formatValue } from './format';
import {
  cardCanvasId,
  frameGroupKey,
  nodeCanvasId,
  parseCanvasId,
  rootCanvasId,
  rootKey,
  terminalCanvasId,
} from './graph/ids';
import { recordAutoNames, recordNames } from './graph/labels';

export interface Entry {
  label: string;
  value: string;
}

export interface FieldRow {
  name: string;
  type: string;
  value: string;
}

export interface PointerRow {
  field: string;
  type: string;
  canvasId: string | null;
}

export type ArrayState = 'cells' | 'pointers' | 'unexpanded';

export interface ArrayView {
  name: string;
  elementType: string;
  length: number;
  truncated: boolean;
  state: ArrayState;
  cells: { index: number; text: string }[];
  targets: { index: number; canvasId: string | null }[];
}

export interface NodeInspection {
  space: 'node';
  canvasId: string;
  title: string;
  recordType: string | null;
  labelNames: string[];
  labelAuto: string[];
  address: string;
  entries: Entry[];
  fields: FieldRow[];
  pointers: PointerRow[];
  arrays: ArrayView[];
  uncertain: boolean;
  errors: ExtractionError[];
}

export interface TerminalInspection {
  space: 'terminal';
  canvasId: string;
  originCanvasId: string;
  originAddress: string;
  originType: string;
  fields: string[];
}

export interface RootInspection {
  space: 'root';
  canvasId: string;
  name: string;
  frame: string;
  entries: Entry[];
  value: string | null;
  nodeCanvasId: string | null;
}

export interface CardVariable {
  canvasId: string;
  name: string;
  frame: string;
  type: string;
  status: Root['status'];
}

export interface CardInspection {
  space: 'card';
  canvasId: string;
  nodeCanvasId: string;
  variables: CardVariable[];
}

export type Inspection = NodeInspection | TerminalInspection | RootInspection | CardInspection;

export interface AnnotationTarget {
  label: string;
  path: string;
}

export interface InspectionIndex {
  nodes: Map<string, GraphNode>;
  roots: Map<string, Root>;
  edgesFrom: Map<string, GraphEdge[]>;
  nodeErrors: Map<string, ExtractionError[]>;
}

export function buildIndex(snapshot: GraphSnapshot): InspectionIndex {
  const nodes = new Map<string, GraphNode>();
  snapshot.nodes.forEach((node) => nodes.set(node.id, node));

  const roots = new Map<string, Root>();
  snapshot.roots.forEach((root) => roots.set(rootKey(root), root));

  const edgesFrom = new Map<string, GraphEdge[]>();
  snapshot.edges.forEach((edge) => {
    const known = edgesFrom.get(edge.from);
    if (known === undefined) {
      edgesFrom.set(edge.from, [edge]);
    } else {
      known.push(edge);
    }
  });

  const nodeErrors = new Map<string, ExtractionError[]>();
  snapshot.meta.errors.forEach((error) => {
    if (error.scope !== 'node' || error.reference === null || error.reference === undefined) {
      return;
    }

    const known = nodeErrors.get(error.reference);
    if (known === undefined) {
      nodeErrors.set(error.reference, [error]);
    } else {
      known.push(error);
    }
  });

  return { nodes, roots, edgesFrom, nodeErrors };
}

export function inScope(root: Root, frames: Set<string> | undefined): boolean {
  return root.origin === 'global' || frames === undefined || frames.has(frameGroupKey(root));
}

export function inspect(
  index: InspectionIndex,
  canvasId: string,
  frames?: Set<string>,
): Inspection | null {
  const parsed = parseCanvasId(canvasId);
  if (parsed === null) {
    return null;
  }

  if (parsed.space === 'node') {
    const node = index.nodes.get(parsed.address);

    return node === undefined ? null : inspectNode(index, node);
  }

  if (parsed.space === 'terminal') {
    return inspectTerminal(index, parsed.address);
  }

  if (parsed.space === 'card') {
    return inspectCard(index, parsed.address, frames);
  }

  const root = index.roots.get(parsed.address);

  return root === undefined ? null : inspectRoot(root);
}

export function annotationTargets(
  index: InspectionIndex,
  canvasId: string,
  frames?: Set<string>,
): AnnotationTarget[] {
  const parsed = parseCanvasId(canvasId);
  if (parsed === null) {
    return [];
  }

  if (parsed.space === 'root') {
    const root = index.roots.get(parsed.address);
    const target = root === undefined ? null : rootTarget(index, root, frames);

    return target === null ? [] : [target];
  }

  if (parsed.space === 'card') {
    return cardRoots(index, parsed.address, frames)
      .map((root) => rootTarget(index, root, frames))
      .filter((target): target is AnnotationTarget => target !== null);
  }

  if (parsed.space !== 'node') {
    return [];
  }

  const node = index.nodes.get(parsed.address);
  if (node === undefined || node.kind !== 'record') {
    return [];
  }

  const holder = reachingRoot(index, node.id, frames);
  if (holder === null) {
    return [];
  }

  const reach = holder.indirections === 0 ? '.' : '->';
  const base = annotationPath(index, holder, frames);

  return (index.edgesFrom.get(node.id) ?? [])
    .filter((edge) => !edge.field.includes('[') && unexpanded(index, edge.to))
    .map((edge) => ({
      label: `${holder.name}${reach}${edge.field}`,
      path: `${base}${reach}${edge.field}`,
    }));
}

function rootTarget(
  index: InspectionIndex,
  root: Root,
  frames: Set<string> | undefined,
): AnnotationTarget | null {
  if (root.category !== 'pointer') {
    return null;
  }

  if (!unexpanded(index, root.node) && !(root.node === null && root.status === 'notFollowed')) {
    return null;
  }

  return { label: root.name, path: annotationPath(index, root, frames) };
}

function unexpanded(index: InspectionIndex, address: string | null): boolean {
  if (address === null) {
    return false;
  }

  const node = index.nodes.get(address);

  return node !== undefined && node.kind === 'opaque' && node.reason === 'notExpanded';
}

function reachingRoot(
  index: InspectionIndex,
  node: string,
  frames: Set<string> | undefined,
): Root | null {
  let nearest: Root | null = null;

  index.roots.forEach((root) => {
    if (root.node !== node || !inScope(root, frames) || root.indirections > 1) {
      return;
    }

    if (nearest === null || root.frameLevel < nearest.frameLevel) {
      nearest = root;
    }
  });

  return nearest;
}

function annotationPath(
  index: InspectionIndex,
  root: Root,
  frames: Set<string> | undefined,
): string {
  let shared = 0;

  index.roots.forEach((other) => {
    if (other.name === root.name && inScope(other, frames)) {
      shared += 1;
    }
  });

  return shared > 1 ? `${root.function}:${root.name}` : root.name;
}

function inspectNode(index: InspectionIndex, node: GraphNode): NodeInspection {
  const edges = index.edgesFrom.get(node.id) ?? [];
  const consumed = new Set<string>();
  const arrays: ArrayView[] = [];
  const entries: Entry[] = [];
  const fields: FieldRow[] = [];

  if (node.kind === 'record') {
    entries.push({ label: 'aggregate', value: node.aggregate });
    entries.push({ label: 'sizeBytes', value: String(node.sizeBytes) });

    node.fields.forEach((field) =>
      fields.push({ name: field.name, type: field.type, value: formatValue(field.value) }),
    );

    node.arrays.forEach((array) =>
      arrays.push(
        arrayView(
          edges,
          consumed,
          array.name,
          array.elementType,
          array.length,
          array.cells,
          array.truncated,
          array.expanded,
        ),
      ),
    );
  } else if (node.kind === 'array') {
    entries.push({ label: 'elementType', value: node.elementType });
    entries.push({ label: 'length', value: String(node.length) });
    entries.push({ label: 'origin', value: node.origin });
    arrays.push(
      arrayView(
        edges,
        consumed,
        '',
        node.elementType,
        node.length,
        node.cellsArePointers ? [] : node.cells,
        node.truncated,
        true,
      ),
    );
  } else {
    if (node.value !== null && node.value !== undefined) {
      entries.push({ label: 'value', value: formatValue(node.value) });
    }

    entries.push({ label: 'reason', value: node.reason });
    if (node.detail !== null && node.detail !== undefined) {
      entries.push({ label: 'detail', value: node.detail });
    }
  }

  const pointers: PointerRow[] = edges
    .filter((edge) => !consumed.has(edge.field))
    .map((edge) => ({
      field: edge.field,
      type: edge.type ?? '',
      canvasId: edge.to === null ? null : nodeCanvasId(edge.to),
    }));

  return {
    space: 'node',
    canvasId: nodeCanvasId(node.id),
    title: nodeTitle(node),
    recordType: node.kind === 'record' ? node.type : null,
    labelNames: node.kind === 'record' ? recordNames(node) : [],
    labelAuto: node.kind === 'record' ? recordAutoNames(node) : [],
    address: node.id,
    entries,
    fields,
    pointers,
    arrays,
    uncertain: node.kind === 'record' && node.uncertain === true,
    errors: index.nodeErrors.get(node.id) ?? [],
  };
}

function arrayView(
  edges: GraphEdge[],
  consumed: Set<string>,
  name: string,
  elementType: string,
  length: number,
  cells: Value[],
  truncated: boolean,
  expanded: boolean,
): ArrayView {
  const found = new Map<number, string | null>();

  edges.forEach((edge) => {
    const index = cellIndex(edge.field, name);
    if (index === null) {
      return;
    }

    consumed.add(edge.field);
    found.set(index, edge.to);
  });

  const targets = [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, to]) => ({ index, canvasId: to === null ? null : nodeCanvasId(to) }));

  const state: ArrayState = !expanded
    ? 'unexpanded'
    : cells.length === 0 && length > 0
      ? 'pointers'
      : 'cells';

  return {
    name,
    elementType,
    length,
    truncated,
    state,
    cells:
      state === 'cells' ? cells.map((cell, index) => ({ index, text: formatValue(cell) })) : [],
    targets: state === 'pointers' ? targets : [],
  };
}

function cellIndex(field: string, name: string): number | null {
  const prefix = `${name}[`;

  if (!field.startsWith(prefix) || !field.endsWith(']')) {
    return null;
  }

  const inner = field.slice(prefix.length, field.length - 1);

  if (inner.length === 0 || !/^\d+$/.test(inner)) {
    return null;
  }

  return Number(inner);
}

function nodeTitle(node: GraphNode): string {
  if (node.kind === 'opaque') {
    return node.type ?? `<${node.reason}>`;
  }

  return node.type;
}

function inspectTerminal(index: InspectionIndex, address: string): TerminalInspection {
  const origin = index.nodes.get(address);
  const edges = index.edgesFrom.get(address) ?? [];

  return {
    space: 'terminal',
    canvasId: terminalCanvasId(address),
    originCanvasId: nodeCanvasId(address),
    originAddress: address,
    originType: origin === undefined ? '' : nodeTitle(origin),
    fields: edges.filter((edge) => edge.to === null).map((edge) => edge.field),
  };
}

function cardRoots(index: InspectionIndex, node: string, frames: Set<string> | undefined): Root[] {
  const held: Root[] = [];

  index.roots.forEach((root) => {
    if (root.node === node && inScope(root, frames)) {
      held.push(root);
    }
  });

  return held;
}

function inspectCard(
  index: InspectionIndex,
  node: string,
  frames: Set<string> | undefined,
): Inspection | null {
  const held = cardRoots(index, node, frames);

  if (held.length === 0) {
    return null;
  }

  if (held.length === 1) {
    return inspectRoot(held[0]);
  }

  return {
    space: 'card',
    canvasId: cardCanvasId(node),
    nodeCanvasId: nodeCanvasId(node),
    variables: held.map((root) => ({
      canvasId: rootCanvasId(root),
      name: root.name,
      frame: `${root.function} #${root.frameLevel}`,
      type: root.type,
      status: root.status,
    })),
  };
}

function inspectRoot(root: Root): RootInspection {
  const entries: Entry[] = [
    { label: 'type', value: root.type },
    { label: 'category', value: root.category },
    { label: 'origin', value: root.origin },
    { label: 'indirections', value: String(root.indirections) },
    { label: 'status', value: root.status },
    { label: 'address', value: root.address ?? 'null' },
    { label: 'target', value: root.target ?? 'null' },
  ];

  return {
    space: 'root',
    canvasId: rootCanvasId(root),
    name: root.name,
    frame: `${root.function} #${root.frameLevel}`,
    entries,
    value: root.value === null || root.value === undefined ? null : formatValue(root.value),
    nodeCanvasId: root.node === null ? null : nodeCanvasId(root.node),
  };
}
