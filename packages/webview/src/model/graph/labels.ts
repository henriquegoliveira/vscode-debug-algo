import type { CardLine, NodeCard } from '../../geometry/nodeMetrics';
import type { FieldChoice } from '../../session/persistence';
import { CanvasNodeKind } from '../../ui/theme';
import { formatValue } from '../format';
import type { FrameRoot, GraphOptions } from './types';
import type { GraphNode, InlineArray, Root } from 'dbga-contract';

const MAX_LABEL_ENTRIES = 2;

const MAX_CELL_PREVIEW = 2;

export type RootInk = 'value' | 'address' | 'null' | 'status';

export function rootCell(root: FrameRoot): string {
  if (root.status !== 'ok') {
    return root.status;
  }

  if (root.value !== '') {
    return root.value;
  }

  return root.target ?? '';
}

export function rootInk(root: FrameRoot): RootInk {
  if (root.status === 'null') {
    return 'null';
  }

  if (root.status !== 'ok') {
    return 'status';
  }

  return root.value === '' ? 'address' : 'value';
}

const ARRAY_CELLS = 'cells';

export const NULL_MARK = 'NULL';

interface Entry {
  name: string;
  value: string;
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

export function rootsCard(roots: Root[]): NodeCard {
  const names: string[] = [];

  roots.forEach((root) => {
    if (!names.includes(root.name)) {
      names.push(root.name);
    }
  });

  return {
    lines: names.map((name) => ({ tier: 'name', ink: 'accent', left: name })),
    address: null,
  };
}

export function terminalCard(): NodeCard {
  return { lines: [{ tier: 'field', ink: 'muted', left: NULL_MARK }], address: null };
}

export function describeNode(
  node: GraphNode,
  options: GraphOptions,
): { kind: CanvasNodeKind; card: NodeCard } {
  const kind = node.kind === 'record' ? 'record' : node.kind === 'array' ? 'array' : 'opaque';
  const card =
    node.kind === 'record'
      ? recordCard(node, options.fields?.[node.type])
      : node.kind === 'array'
        ? arrayCard(node)
        : opaqueCard(node);

  return { kind, card };
}

function recordCard(
  node: Extract<GraphNode, { kind: 'record' }>,
  choice: FieldChoice | undefined,
): NodeCard {
  const entries = recordPairs(node);
  const shown = chosenEntries(node, entries, choice);

  return card(node.type, shown.map(entryLine), entries.length - shown.length, node.id);
}

function chosenEntries(
  node: Extract<GraphNode, { kind: 'record' }>,
  entries: Entry[],
  choice: FieldChoice | undefined,
): Entry[] {
  if (choice === undefined) {
    return entries.slice(0, Math.min(node.fields.length, MAX_LABEL_ENTRIES));
  }

  if (choice === 'none') {
    return [];
  }

  if (choice === 'all') {
    return entries;
  }

  return entries.filter((entry) => choice.includes(entry.name));
}

function recordPairs(node: Extract<GraphNode, { kind: 'record' }>): Entry[] {
  return [
    ...node.fields.map((field) => ({ name: field.name, value: formatValue(field.value) })),
    ...node.arrays.map(arrayEntry),
  ];
}

function entryLine(entry: Entry): CardLine {
  return {
    tier: 'field',
    ink: 'muted',
    left: entry.name,
    right: entry.value,
    rightInk: 'value',
  };
}

function arrayEntry(array: InlineArray): Entry {
  if (array.cells.length === 0) {
    return { name: array.name, value: `[${array.length}]` };
  }

  const shown = array.cells.slice(0, MAX_CELL_PREVIEW).map(formatValue);
  const hidden = array.cells.length - shown.length;
  const tail = hidden > 0 ? [`+${hidden}`] : [];

  return { name: array.name, value: [...shown, ...tail].join(', ') };
}

function arrayCard(node: Extract<GraphNode, { kind: 'array' }>): NodeCard {
  if (node.cellsArePointers) {
    return card(node.type, [], 0, node.id);
  }

  const shown = node.cells.slice(0, MAX_CELL_PREVIEW).map(formatValue);
  const line: CardLine = { tier: 'field', ink: 'value', left: shown.join(', ') };

  return card(node.type, [line], node.cells.length - shown.length, node.id);
}

function opaqueCard(node: Extract<GraphNode, { kind: 'opaque' }>): NodeCard {
  if (node.value === null || node.value === undefined) {
    const line: CardLine = { tier: 'field', ink: 'muted', left: `<${node.reason}>` };

    return card(node.type ?? null, [line], 0, node.id);
  }

  const value = formatValue(node.value);

  if (node.type === null || node.type === undefined) {
    return card(null, [{ tier: 'field', ink: 'value', left: value }], 0, node.id);
  }

  return {
    lines: [{ tier: 'type', ink: 'accent', left: node.type, right: value, rightInk: 'value' }],
    address: node.id,
  };
}

function card(type: string | null, lines: CardLine[], hidden: number, address: string): NodeCard {
  const head: CardLine[] = type === null ? [] : [{ tier: 'type', ink: 'accent', left: type }];
  const tail: CardLine[] = hidden > 0 ? [{ tier: 'note', ink: 'muted', left: `+${hidden}` }] : [];

  return { lines: [...head, ...lines, ...tail], address };
}
