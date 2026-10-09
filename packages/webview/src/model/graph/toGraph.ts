import { EDGE_WIDTH, HIGHLIGHT_WIDTH, arrowScale } from '../../geometry/arrows';
import { type Box, type Placed } from '../../geometry/boxes';
import { nodeMetrics } from '../../geometry/nodeMetrics';
import { orbitSeat, wedgeAngles } from '../../geometry/orbit';
import {
  type TreePosition,
  byField,
  structuralLevels,
  treePositions,
} from '../../geometry/treeLayout';
import { CanvasNodeKind, FALLBACK_THEME, Theme } from '../../ui/theme';
import { formatValue } from '../format';
import {
  EDGE_PREFIX,
  NULL_FIELD,
  ROOT_EDGE_PREFIX,
  cardCanvasId,
  frameGroupKey,
  frameKey,
  nodeCanvasId,
  rootCanvasId,
  terminalCanvasId,
} from './ids';
import { baseNames, describeNode, rootsCard, terminalCard } from './labels';
import { styled } from './style';
import {
  type CanvasEdge,
  type CanvasNode,
  type CanvasSmooth,
  type CardGroup,
  type FrameGroup,
  type FrameRoot,
  type GraphModel,
  type GraphOptions,
  DEFAULT_OPTIONS,
  RECIPROCAL_ROUNDNESS,
} from './types';
import { reciprocalPairs, visibleSnapshot } from './visibility';
import type { Frame, GraphEdge, GraphNode, GraphSnapshot, Root } from 'dbga-contract';

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
    const { kind, card } = describeNode(node, options);

    sizes.set(node.id, nodeMetrics(card, kind, theme, false).box);
  });

  const laid = options.nullTerminals ? withTerminals(view, nullFieldsByOrigin, sizes, theme) : view;

  const levels = structuralLevels(laid);
  const seats = treePositions(laid, sizes);
  const reciprocal = reciprocalPairs(view);
  const wedges = wedgeAngles(laid, seats, options.pinned);
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
      const id = terminalCanvasId(from);

      nodes.push(
        styled(id, 'null', terminalCard(), theme, levels.get(id), seats.get(id), options.pinned),
      );
      edges.push({
        id: `${EDGE_PREFIX}${from}:${NULL_FIELD}`,
        from: nodeCanvasId(from),
        to: id,
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
    const balloon = rootsCard(held);
    const kind: CanvasNodeKind = degraded === undefined ? 'root' : 'rootDegraded';
    const box = nodeMetrics(balloon, kind, theme, false).box;
    const berth = orbitSeat(seats.get(card.node), rank, occupied, wedges.get(card.node), box);

    if (berth !== undefined) {
      occupied.push({ ...berth, box });
    }

    const change = options.highlight?.get(card.node);

    nodes.push(
      styled(card.id, kind, balloon, theme, levels.get(card.node), berth, options.pinned, change),
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
      target: root.target,
      name: root.name,
      type: root.type,
      origin: root.origin,
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

function withTerminals(
  view: GraphSnapshot,
  nullFieldsByOrigin: Map<string, string[]>,
  sizes: Map<string, Box>,
  theme: Theme,
): GraphSnapshot {
  const extraNodes: GraphNode[] = [];
  const extraEdges: GraphEdge[] = [];
  const terminal = nodeMetrics(terminalCard(), 'null', theme, false).box;

  nullFieldsByOrigin.forEach((fields, from) => {
    const id = terminalCanvasId(from);

    extraNodes.push({ kind: 'opaque', id, reason: 'notExpanded' });
    extraEdges.push({ from, field: `${[...fields].sort(byField)[0]}${NULL_FIELD}`, to: id });
    sizes.set(id, terminal);
  });

  return {
    ...view,
    nodes: [...view.nodes, ...extraNodes],
    edges: [...view.edges, ...extraEdges],
  };
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
    size: theme.text.field,
    strokeWidth: 0,
    face: theme.fontFace,
    background: theme.edge.labelBackground,
  };
}

function canvasNode(
  node: GraphNode,
  theme: Theme,
  level: number | undefined,
  seat: TreePosition | undefined,
  pinned: boolean,
  options: GraphOptions,
): CanvasNode {
  const { kind, card } = describeNode(node, options);

  return styled(
    nodeCanvasId(node.id),
    kind,
    card,
    theme,
    level,
    seat,
    pinned,
    options.highlight?.get(node.id),
  );
}
