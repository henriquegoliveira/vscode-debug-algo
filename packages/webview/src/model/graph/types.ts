import type { NodeCard, NodeMetrics } from '../../geometry/nodeMetrics';
import type { FieldChoice } from '../../session/persistence';
import { CanvasNodeKind, ChangeKind, NodePalette } from '../../ui/theme';
import type { GraphSnapshot, Root } from 'dbga-contract';

export const RECIPROCAL_ROUNDNESS = 0.25;

export const DRIFT_TOLERANCE = 220;

export type CanvasArrows = 'to' | { to: { enabled: true; scaleFactor: number } };

export type CanvasSmooth =
  { enabled: true; type: 'curvedCW'; roundness: number } | { enabled: false };

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  shape: string;
  level?: number;
  x?: number;
  y?: number;
  fixed: boolean;
  physics: boolean;
  borderWidth: number;
  card: NodeCard;
  metrics: NodeMetrics;
  metricsSelected: NodeMetrics;
  palette: NodePalette;
  change?: ChangeKind;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  arrows: CanvasArrows;
  dashes: boolean;
  width?: number;
  smooth?: CanvasSmooth;
  color: { color: string };
  font: { color: string; size: number; strokeWidth: number; face: string; background: string };
}

export interface FrameRoot {
  id: string;
  canvasId: string | null;
  target: string | null;
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
  enabled: boolean;
  roots: FrameRoot[];
}

export interface CardGroup {
  id: string;
  node: string;
  roots: string[];
}

export interface GraphModel {
  canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] };
  frames: FrameGroup[];
  globals: FrameRoot[];
  cards: CardGroup[];
}

export interface GraphOptions {
  nullTerminals: boolean;
  pinned: boolean;
  frames?: Set<string>;
  fields?: Record<string, FieldChoice>;
  highlight?: Map<string, ChangeKind>;
  highlightEdges?: Set<string>;
}

export interface NodeChanges {
  created: string[];
  relinked: string[];
  valued: string[];
  destinations: Record<string, string[]>;
  edges: string[];
}

export const NO_CHANGES: NodeChanges = {
  created: [],
  relinked: [],
  valued: [],
  destinations: {},
  edges: [],
};

export interface Pass {
  changes: NodeChanges;
  first: boolean;
  of: GraphSnapshot | null;
  previous: GraphSnapshot | null;
}

export const DEFAULT_OPTIONS: GraphOptions = { nullTerminals: false, pinned: false };
