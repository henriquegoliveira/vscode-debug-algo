/**
 * Segue o schema formal em packages/extension/schemas/graph-snapshot.schema.json.
 * Por hora segue o escopo mínimo (id/value, from/to)
 */

export interface GraphNode {
  id: string;
  value: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
