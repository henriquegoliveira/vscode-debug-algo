import type { Frame, GraphNode, GraphSnapshot, InlineArray, Root } from 'dbga-contract';
import type { TreePosition } from './treeLayout';
import type { FieldChoice } from './persistence';
import { formatValue } from './format';
import { CanvasNodeKind, ChangeKind, FALLBACK_THEME, Theme } from './theme';
import { LEVEL_SEPARATION, structuralForest, structuralLevels, treePositions } from './treeLayout';
import { type Box, type Placed, labelBox, separation } from './boxes';

const NODE_PREFIX = 'n:';
const TERMINAL_PREFIX = 't:';
const ROOT_PREFIX = 'r:';
const EDGE_PREFIX = 'e:';
const ROOT_EDGE_PREFIX = 're:';
const CARD_PREFIX = 'c:';
const NULL_FIELD = '@null';

const MAX_LABEL_ENTRIES = 2;
const MAX_CELL_PREVIEW = 2;

export const ROOT_RADIUS = 210;
export const ROOT_SPREAD = 20;
export const ROOT_BASE_ANGLE = 210;
export const ROOT_GAP = 60;
export const ORBIT_STEPS = 19;
export const ORBIT_RINGS = [1, 1.45, 1.9, 2.35, 2.8];
export const RECIPROCAL_ROUNDNESS = 0.25;
export const DRIFT_TOLERANCE = 220;
export const BORDER_WIDTH = 1;
export const EDGE_WIDTH = 1;
export const HIGHLIGHT_WIDTH = 3;
export const ARROW_SCALE = 0.45;
export const ARROW_BASE = 15;
export const ARROW_PER_WIDTH = 3;
export const ARROW_MIN_SCALE = 0.05;

export function arrowLength(scaleFactor: number, width: number): number {
  return ARROW_BASE * scaleFactor + ARROW_PER_WIDTH * width;
}

export function arrowScale(width: number): number {
  const wanted = arrowLength(ARROW_SCALE, EDGE_WIDTH) - ARROW_PER_WIDTH * width;

  return Math.max(ARROW_MIN_SCALE, wanted / ARROW_BASE);
}

export type { CanvasNodeKind, ChangeKind };

export type CanvasSpace = 'node' | 'terminal' | 'root' | 'card';

export type CanvasArrows = 'to' | { to: { enabled: true; scaleFactor: number } };

export type CanvasSmooth =
  { enabled: true; type: 'curvedCW'; roundness: number } | { enabled: false };

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
  borderWidth: number;
  color: { background: string; border: string };
  shadow?: { enabled: boolean; color: string; size: number; x: number; y: number };
  font: { color: string; face: string };
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

export function cardCanvasId(node: string): string {
  return `${CARD_PREFIX}${node}`;
}

export function frameKey(fn: string, level: number): string {
  return `${fn}#${level}`;
}

export function frameGroupKey(root: Root): string {
  return frameKey(root.function, root.frameLevel);
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

  if (id.startsWith(CARD_PREFIX)) {
    return { space: 'card', address: id.slice(CARD_PREFIX.length) };
  }

  return null;
}

export { structuralForest, structuralLevels, treePositions };

export function reachableNodes(snapshot: GraphSnapshot, frames: Set<string>): Set<string> {
  const outgoing = new Map<string, string[]>();

  snapshot.edges.forEach((edge) => {
    if (edge.to === null) {
      return;
    }

    const known = outgoing.get(edge.from);
    if (known === undefined) {
      outgoing.set(edge.from, [edge.to]);
    } else {
      known.push(edge.to);
    }
  });

  const walk = (seeds: string[]): Set<string> => {
    const seen = new Set<string>();
    const queue: string[] = [];

    seeds.forEach((seed) => {
      if (!seen.has(seed)) {
        seen.add(seed);
        queue.push(seed);
      }
    });

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      (outgoing.get(queue[cursor]) ?? []).forEach((to) => {
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      });
    }

    return seen;
  };

  const targets = (chosen?: Set<string>): string[] =>
    snapshot.roots
      .filter(
        (root) =>
          root.node !== null &&
          (chosen === undefined || root.origin === 'global' || chosen.has(frameGroupKey(root))),
      )
      .map((root) => root.node as string);

  const owned = walk(targets());
  const unowned = snapshot.nodes.filter((node) => !owned.has(node.id)).map((node) => node.id);

  return walk([...targets(frames), ...unowned]);
}

export function visibleSnapshot(snapshot: GraphSnapshot, frames?: Set<string>): GraphSnapshot {
  if (frames === undefined) {
    return snapshot;
  }

  const reachable = reachableNodes(snapshot, frames);
  if (reachable.size === snapshot.nodes.length) {
    return snapshot;
  }

  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => reachable.has(node.id)),
    edges: snapshot.edges.filter(
      (edge) => reachable.has(edge.from) && (edge.to === null || reachable.has(edge.to)),
    ),
  };
}

export function wedgeAngles(
  snapshot: GraphSnapshot,
  seats: Map<string, TreePosition>,
): Map<string, number> {
  const neighbours = new Map<string, Set<string>>();

  const link = (from: string, to: string): void => {
    const known = neighbours.get(from);
    if (known === undefined) {
      neighbours.set(from, new Set([to]));
    } else {
      known.add(to);
    }
  };

  snapshot.edges.forEach((edge) => {
    if (edge.to === null || edge.to === edge.from) {
      return;
    }

    link(edge.from, edge.to);
    link(edge.to, edge.from);
  });

  const angles = new Map<string, number>();

  seats.forEach((seat, id) => {
    const around: number[] = [];

    (neighbours.get(id) ?? new Set<string>()).forEach((other) => {
      const at = seats.get(other);
      if (at === undefined || (at.x === seat.x && at.y === seat.y)) {
        return;
      }

      around.push(degrees(Math.atan2(at.y - seat.y, at.x - seat.x)));
    });

    if (around.length === 0) {
      return;
    }

    around.sort((a, b) => a - b);

    let widest = -1;
    let middle = ROOT_BASE_ANGLE;

    around.forEach((angle, position) => {
      const next = position + 1 < around.length ? around[position + 1] : around[0] + 360;
      const gap = next - angle;

      if (gap > widest) {
        widest = gap;
        middle = angle + gap / 2;
      }
    });

    angles.set(id, ((middle % 360) + 360) % 360);
  });

  return angles;
}

export function changedNodes(previous: GraphSnapshot, next: GraphSnapshot): NodeChanges {
  const alive = new Set(next.nodes.map((node) => node.id));
  const before = new Set(previous.nodes.map((node) => node.id));

  const created = next.nodes.filter((node) => !before.has(node.id)).map((node) => node.id);
  const isNew = new Set(created);

  const wasLinked = edgeTargets(previous);
  const nowLinked = edgeTargets(next);

  const relinked = new Set<string>();
  const touched = new Set<string>();
  const destinations: Record<string, string[]> = {};

  const note = (key: string, to: string | null | undefined): void => {
    const from = edgeOrigin(key);

    if (!alive.has(from) || isNew.has(from)) {
      return;
    }

    relinked.add(from);
    touched.add(`${from}:${key.slice(from.length + 1)}`);

    if (to === null || to === undefined || !alive.has(to)) {
      return;
    }

    const known = destinations[from];
    if (known === undefined) {
      destinations[from] = [to];
    } else if (!known.includes(to)) {
      known.push(to);
    }
  };

  nowLinked.forEach((to, key) => {
    if (wasLinked.get(key) !== to) {
      note(key, to);
    }
  });

  wasLinked.forEach((to, key) => {
    if (!nowLinked.has(key)) {
      note(key, undefined);
    }
  });

  const fingerprints = new Map(previous.nodes.map((node) => [node.id, valueFingerprint(node)]));

  const valued = next.nodes
    .filter(
      (node) =>
        !isNew.has(node.id) &&
        !relinked.has(node.id) &&
        fingerprints.get(node.id) !== valueFingerprint(node),
    )
    .map((node) => node.id);

  return { created, relinked: [...relinked], valued, destinations, edges: [...touched] };
}

export function changeHighlight(pass: Pass, of: GraphSnapshot | null): Map<string, ChangeKind> {
  const marks = new Map<string, ChangeKind>();

  if (pass.of !== of) {
    return marks;
  }

  pass.changes.valued.forEach((id) => marks.set(id, 'valued'));
  pass.changes.relinked.forEach((id) => {
    marks.set(id, 'relinked');
    (pass.changes.destinations[id] ?? []).forEach((other) => {
      if (!marks.has(other)) {
        marks.set(other, 'relinked');
      }
    });
  });
  pass.changes.created.forEach((id) => marks.set(id, 'created'));

  return marks;
}

export function focusTarget(
  snapshot: GraphSnapshot,
  changes: NodeChanges,
  drawn: Set<string>,
): string[] {
  const wanted: string[] = [];

  [changes.created, changes.relinked, changes.valued].forEach((bucket) =>
    bucket.forEach((id) => {
      wanted.push(id);
      (changes.destinations[id] ?? []).forEach((other) => wanted.push(other));
    }),
  );

  return unique(wanted.map(nodeCanvasId).filter((id) => drawn.has(id))).sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function edgeTargets(snapshot: GraphSnapshot): Map<string, string | null> {
  const targets = new Map<string, string | null>();

  snapshot.edges.forEach((edge) => targets.set(`${edge.from} ${edge.field}`, edge.to));

  return targets;
}

function edgeOrigin(key: string): string {
  return key.slice(0, key.indexOf(' '));
}

function valueFingerprint(node: GraphNode): string {
  if (node.kind === 'record') {
    return JSON.stringify([
      node.fields.map((field) => [field.name, field.value]),
      node.arrays.map((array) => [array.name, array.cells]),
    ]);
  }

  if (node.kind === 'array') {
    return JSON.stringify(node.cells);
  }

  return JSON.stringify(node.value ?? null);
}

export function toGraph(
  snapshot: GraphSnapshot,
  theme: Theme = FALLBACK_THEME,
  options: GraphOptions = DEFAULT_OPTIONS,
): GraphModel {
  const view = visibleSnapshot(snapshot, options.frames);
  const shown = new Set(view.nodes.map((node) => node.id));

  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  const nullFieldsByOrigin = new Map<string, string[]>();

  view.edges.forEach((edge) => {
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

  const sizes = new Map<string, Box>();

  view.nodes.forEach((node) => {
    const { kind, label } = describeNode(node, options);

    sizes.set(node.id, labelBox(label, kind));
  });

  const levels = structuralLevels(view);
  const seats = treePositions(view, sizes);
  const reciprocal = reciprocalPairs(view);
  const wedges = wedgeAngles(view, seats);
  const occupied: Placed[] = [...seats.entries()].map(([id, at]) => ({
    ...at,
    box: sizes.get(id) ?? { width: 0, height: 0 },
  }));

  view.nodes.forEach((node) =>
    nodes.push(
      canvasNode(node, theme, levels.get(node.id), seats.get(node.id), options.pinned, options),
    ),
  );

  view.edges.forEach((edge) => {
    if (edge.to === null) {
      return;
    }

    const marked = options.highlightEdges?.has(`${edge.from}:${edge.field}`) ?? false;

    edges.push({
      id: `${EDGE_PREFIX}${edge.from}:${edge.field}`,
      from: nodeCanvasId(edge.from),
      to: nodeCanvasId(edge.to),
      label: edge.field,
      arrows: marked ? { to: { enabled: true, scaleFactor: arrowScale(HIGHLIGHT_WIDTH) } } : 'to',
      dashes: false,
      width: marked ? HIGHLIGHT_WIDTH : EDGE_WIDTH,
      ...reciprocalSmooth(edge.from, edge.to, reciprocal),
      color: { color: marked ? theme.change.relinked : theme.edge.color },
      font: edgeFont(theme),
    });
  });

  if (options.nullTerminals) {
    nullFieldsByOrigin.forEach((fields, from) => {
      const origin = levels.get(from);
      const seat = seats.get(from);

      if (seat !== undefined) {
        occupied.push({
          x: seat.x,
          y: seat.y + LEVEL_SEPARATION,
          box: labelBox(NULL_MARK, 'null'),
        });
      }

      nodes.push(
        styled(
          terminalCanvasId(from),
          'null',
          NULL_MARK,
          theme,
          origin === undefined ? undefined : origin + 1,
          seat === undefined ? undefined : { x: seat.x, y: seat.y + LEVEL_SEPARATION },
          options.pinned,
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

  const drawable = (root: Root): boolean =>
    root.node !== null &&
    shown.has(root.node) &&
    (root.origin === 'global' ||
      options.frames === undefined ||
      options.frames.has(frameGroupKey(root)));

  const cards: CardGroup[] = [];
  const cardIndex = new Map<string, CardGroup>();
  const cardRoots = new Map<string, Root[]>();

  snapshot.roots.forEach((root) => {
    if (!drawable(root)) {
      return;
    }

    const target = root.node as string;
    let card = cardIndex.get(target);

    if (card === undefined) {
      card = { id: cardCanvasId(target), node: target, roots: [] };
      cardIndex.set(target, card);
      cardRoots.set(target, []);
      cards.push(card);
    }

    card.roots.push(rootCanvasId(root));
    (cardRoots.get(target) as Root[]).push(root);
  });

  cards.forEach((card, rank) => {
    const held = cardRoots.get(card.node) as Root[];
    const degraded = held.find((root) => root.status !== 'ok');
    const label = cardLabel(held);
    const kind: CanvasNodeKind = degraded === undefined ? 'root' : 'rootDegraded';
    const box = labelBox(label, kind);
    const berth = orbitSeat(seats.get(card.node), rank, occupied, wedges.get(card.node), box);

    if (berth !== undefined) {
      occupied.push({ ...berth, box });
    }

    const change = options.highlight?.get(card.node);

    nodes.push(
      styled(card.id, kind, label, theme, levels.get(card.node), berth, options.pinned, change),
    );
    edges.push({
      id: `${ROOT_EDGE_PREFIX}${card.id}`,
      from: card.id,
      to: nodeCanvasId(card.node),
      label: degraded === undefined ? '' : degraded.status,
      arrows: 'to',
      dashes: degraded !== undefined,
      smooth: { enabled: false },
      color: { color: theme.edge.rootColor },
      font: edgeFont(theme),
    });
  });

  const frameGroup = (frame: Frame): FrameGroup => {
    const key = frameKey(frame.function, frame.level);

    return {
      id: key,
      function: frame.function,
      frameLevel: frame.level,
      enabled: options.frames === undefined || options.frames.has(key),
      roots: [],
    };
  };

  const frames: FrameGroup[] = snapshot.frames.map(frameGroup);
  const frameIndex = new Map(frames.map((group) => [group.id, group]));
  const globals: FrameRoot[] = [];

  snapshot.roots.forEach((root) => {
    const id = rootCanvasId(root);
    const card = drawable(root) ? cardIndex.get(root.node as string) : undefined;
    const frameRoot: FrameRoot = {
      id,
      canvasId: card === undefined ? null : card.id,
      name: root.name,
      type: root.type,
      origin: root.origin,
      category: root.category,
      status: root.status,
      value: formatValue(root.value),
    };

    if (root.origin === 'global') {
      globals.push(frameRoot);
      return;
    }

    const key = frameGroupKey(root);
    let group = frameIndex.get(key);

    if (group === undefined) {
      group = frameGroup({ level: root.frameLevel, function: root.function, file: '', line: 0 });
      frameIndex.set(key, group);
      frames.push(group);
    }

    group.roots.push(frameRoot);
  });

  frames.sort((a, b) => a.frameLevel - b.frameLevel);

  return { canvas: { nodes, edges }, frames, globals, cards };
}

export function rootFollowers(model: GraphModel): Map<string, string[]> {
  const balloons = new Set(
    model.canvas.nodes
      .filter((node) => node.kind === 'root' || node.kind === 'rootDegraded')
      .map((node) => node.id),
  );

  const followers = new Map<string, string[]>();

  model.canvas.edges.forEach((edge) => {
    if (!balloons.has(edge.from) || balloons.has(edge.to)) {
      return;
    }

    const known = followers.get(edge.to);
    if (known === undefined) {
      followers.set(edge.to, [edge.from]);
    } else {
      known.push(edge.from);
    }
  });

  return followers;
}

export function reciprocalPairs(snapshot: GraphSnapshot): Set<string> {
  const directed = new Set<string>();

  snapshot.edges.forEach((edge) => {
    if (edge.to !== null) {
      directed.add(`${edge.from} ${edge.to}`);
    }
  });

  const both = new Set<string>();
  directed.forEach((pair) => {
    const [from, to] = pair.split(' ');
    if (directed.has(`${to} ${from}`)) {
      both.add(pair);
    }
  });

  return both;
}

export function orbitSeat(
  seat: TreePosition | undefined,
  rank: number,
  occupied: Placed[] = [],
  base: number = ROOT_BASE_ANGLE,
  box: Box = { width: ROOT_GAP, height: ROOT_GAP },
): TreePosition | undefined {
  if (seat === undefined) {
    return undefined;
  }

  let best: TreePosition | undefined;
  let widest = Number.NEGATIVE_INFINITY;

  for (const ring of ORBIT_RINGS) {
    for (let step = 0; step < ORBIT_STEPS; step += 1) {
      const angle = ((base + alternate(rank + step) * ROOT_SPREAD) * Math.PI) / 180;
      const at = {
        x: seat.x + ROOT_RADIUS * ring * Math.cos(angle),
        y: seat.y + ROOT_RADIUS * ring * Math.sin(angle),
      };

      const clearance = occupied.reduce(
        (least, other) => Math.min(least, separation({ ...at, box }, other)),
        Number.POSITIVE_INFINITY,
      );

      if (clearance >= ROOT_GAP) {
        return at;
      }

      if (clearance > widest) {
        widest = clearance;
        best = at;
      }
    }
  }

  return best;
}

export function alternate(step: number): number {
  const turn = Math.ceil(step / 2);

  return step % 2 === 0 ? turn : -turn;
}

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

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function degrees(radians: number): number {
  return ((((radians * 180) / Math.PI) % 360) + 360) % 360;
}

function reciprocalSmooth(
  from: string,
  to: string,
  reciprocal: Set<string>,
): { smooth?: CanvasSmooth } {
  if (!reciprocal.has(`${from} ${to}`)) {
    return {};
  }

  return { smooth: { enabled: true, type: 'curvedCW', roundness: RECIPROCAL_ROUNDNESS } };
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

function cardLabel(roots: Root[]): string {
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

function canvasNode(
  node: GraphNode,
  theme: Theme,
  level: number | undefined,
  seat: TreePosition | undefined,
  pinned: boolean,
  options: GraphOptions,
): CanvasNode {
  const { kind, label } = describeNode(node, options);

  return styled(
    nodeCanvasId(node.id),
    kind,
    label,
    theme,
    level,
    seat,
    pinned,
    options.highlight?.get(node.id),
  );
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

function styled(
  id: string,
  kind: CanvasNodeKind,
  label: string,
  theme: Theme,
  level: number | undefined,
  seat: TreePosition | undefined,
  pinned: boolean,
  change?: ChangeKind,
): CanvasNode {
  const palette = theme.nodes[kind];
  const marked = change !== undefined;
  const node: CanvasNode = {
    id,
    kind,
    label,
    shape: NODE_SHAPE[kind],
    fixed: false,
    physics: !pinned,
    borderWidth: marked ? HIGHLIGHT_WIDTH : BORDER_WIDTH,
    color: {
      background: palette.background,
      border: marked ? theme.change[change] : palette.border,
    },
    font: { color: palette.text, face: theme.fontFace },
  };

  if (marked) {
    node.shadow = { enabled: true, color: theme.change[change], size: 18, x: 0, y: 0 };
  }

  if (level !== undefined) {
    node.level = level;
  }

  if (seat !== undefined) {
    node.x = seat.x;
    node.y = seat.y;
  }

  return node;
}
