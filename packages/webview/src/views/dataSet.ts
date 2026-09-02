import { CanvasEdge, CanvasNode } from '../model/graph/types';
import { DataSet } from 'vis-data';
import { Edge, Node } from 'vis-network';

export function remove<T extends Node | Edge>(
  dataSet: DataSet<T>,
  next: (CanvasNode | CanvasEdge)[],
): void {
  const keep = new Set(next.map((item) => item.id));
  const stale = (dataSet.getIds() as string[]).filter((id) => !keep.has(id));

  if (stale.length > 0) {
    dataSet.remove(stale);
  }
}
