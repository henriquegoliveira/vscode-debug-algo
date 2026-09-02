import type { FieldChoice } from '../../session/persistence';
import { CanvasNodeKind } from '../../ui/theme';
import { formatValue } from '../format';
import type { FrameRoot, GraphOptions } from './types';
import type { GraphNode, InlineArray, Root } from 'dbga-contract';

const MAX_LABEL_ENTRIES = 2;

const MAX_CELL_PREVIEW = 2;

export function rootCell(root: FrameRoot): string {
  if (root.status !== 'ok') {
    return root.status;
  }

  if (root.value !== '') {
    return root.value;
  }

  return root.target ?? '';
}

const ARRAY_CELLS = 'cells';

export const NULL_MARK = 'NULL';

export function recordEntries(node: Extract<GraphNode, { kind: 'record' }>): string[] {
  return [
    ...node.fields.map((field) => `${field.name} = ${formatValue(field.value)}`),
    ...node.arrays.map(arrayEntry),
  ];
}

export function recordNames(node: Extract<GraphNode, { kind: 'record' }>): string[] {
  return [...node.fields.map((field) => field.name), ...node.arrays.map((array) => array.name)];
}

export function recordAutoNames(node: Extract<GraphNode, { kind: 'record' }>): string[] {
  return node.fields.slice(0, MAX_LABEL_ENTRIES).map((field) => field.name);
}

export function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function baseNames(fields: string[]): string[] {
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

export function cardLabel(roots: Root[]): string {
  const names: string[] = [];

  roots.forEach((root) => {
    if (!names.includes(root.name)) {
      names.push(root.name);
    }
  });

  return names.join('\n');
}

export function describeNode(
  node: GraphNode,
  options: GraphOptions,
): { kind: CanvasNodeKind; label: string } {
  const kind = node.kind === 'record' ? 'record' : node.kind === 'array' ? 'array' : 'opaque';
  const label =
    node.kind === 'record'
      ? recordLabel(node, options.fields?.[node.type])
      : node.kind === 'array'
        ? arrayLabel(node)
        : opaqueLabel(node);

  return { kind, label };
}

function recordLabel(
  node: Extract<GraphNode, { kind: 'record' }>,
  choice: FieldChoice | undefined,
): string {
  const entries = recordEntries(node);

  if (choice === undefined) {
    const shown = node.fields
      .slice(0, MAX_LABEL_ENTRIES)
      .map((field) => `${field.name} = ${formatValue(field.value)}`);

    return join(node.type, shown, entries.length - shown.length);
  }

  if (choice === 'none') {
    return join(node.type, [], entries.length);
  }

  const names = recordNames(node);
  const keep = choice === 'all' ? names : names.filter((name) => choice.includes(name));
  const shown = entries.filter((entry, position) => keep.includes(names[position]));

  return join(node.type, shown, entries.length - shown.length);
}

function arrayEntry(array: InlineArray): string {
  if (array.cells.length === 0) {
    return `${array.name}[${array.length}]`;
  }

  const shown = array.cells.slice(0, MAX_CELL_PREVIEW).map(formatValue);
  const hidden = array.cells.length - shown.length;
  const tail = hidden > 0 ? [`+${hidden}`] : [];

  return `${array.name} = ${[...shown, ...tail].join(', ')}`;
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
  const detail =
    node.value === null || node.value === undefined ? `<${node.reason}>` : formatValue(node.value);

  return declared === null ? detail : [declared, detail].join('\n');
}

function join(head: string, shown: string[], hidden: number): string {
  const tail = hidden > 0 ? [`+${hidden}`] : [];

  return [head, ...shown, ...tail].join('\n');
}
