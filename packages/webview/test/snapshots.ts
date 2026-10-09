import type { GraphNode, GraphSnapshot, Root, Value } from 'dbga-contract';
import binarySearchTree from '../../../tests/fixtures/binary_search_tree.json';
import classReference from '../../../tests/fixtures/class_reference.json';
import linkedListCyclic from '../../../tests/fixtures/linked_list_cyclic.json';
import linkedListDouble from '../../../tests/fixtures/linked_list_double_linear_head.json';
import recursionFirst from '../../../tests/fixtures/recursion.0.json';
import recursionSecond from '../../../tests/fixtures/recursion.1.json';
import sortingMergeFirst from '../../../tests/fixtures/sorting_merge.0.json';
import sortingMergeSecond from '../../../tests/fixtures/sorting_merge.1.json';

const frozen = (json: unknown): GraphSnapshot => structuredClone(json) as GraphSnapshot;

export const binarySearchTreeSnapshot = (): GraphSnapshot => frozen(binarySearchTree);
export const classReferenceSnapshot = (): GraphSnapshot => frozen(classReference);
export const linkedListCyclicSnapshot = (): GraphSnapshot => frozen(linkedListCyclic);
export const linkedListDoubleSnapshot = (): GraphSnapshot => frozen(linkedListDouble);
export const recursionPauses = (): [GraphSnapshot, GraphSnapshot] => [
  frozen(recursionFirst),
  frozen(recursionSecond),
];
export const sortingMergePauses = (): [GraphSnapshot, GraphSnapshot] => [
  frozen(sortingMergeFirst),
  frozen(sortingMergeSecond),
];

export function intValue(v: number): Value {
  return { t: 'int', v, signed: true };
}

export function listNode(id: string, value: number): GraphNode {
  return {
    kind: 'record',
    id,
    type: 'Node',
    aggregate: 'struct',
    sizeBytes: 16,
    fields: [{ name: 'value', type: 'int', value: intValue(value) }],
    arrays: [],
  };
}

export function pointerRoot(name: string, node: string | null, frameLevel = 0): Root {
  return {
    name,
    function: frameLevel === 0 ? 'push' : 'main',
    frameLevel,
    origin: 'local',
    type: 'Node *',
    category: 'pointer',
    address: `0x7ffe00${frameLevel}0${name.length}0`,
    target: node,
    indirections: 1,
    node,
    status: 'ok',
  };
}

export function linkedList(
  values: [string, number][],
  links: [string, string | null][],
): GraphSnapshot {
  return {
    meta: {
      version: 2,
      debugger: 'GDB',
      debuggerVersion: '17.2',
      generatedAt: 0,
      truncated: false,
      truncationReasons: [],
      framesScanned: 2,
      framesSkipped: 0,
      observedTypes: [
        {
          type: 'Node',
          pointerFields: ['next'],
          scalarFields: ['value'],
          count: values.length,
          maxDegree: 1,
        },
      ],
      errors: [],
    },
    frames: [
      { level: 0, function: 'push', file: '/src/list.c', line: 12 },
      { level: 1, function: 'main', file: '/src/list.c', line: 30 },
    ],
    roots: values.length === 0 ? [] : [pointerRoot('head', values[0][0], 1)],
    nodes: values.map(([id, value]) => listNode(id, value)),
    edges: links.map(([from, to]) => ({ from, field: 'next', to, type: 'Node *' })),
  };
}
