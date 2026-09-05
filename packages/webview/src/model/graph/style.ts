import { HIGHLIGHT_WIDTH } from '../../geometry/arrows';
import { type NodeCard, nodeMetrics } from '../../geometry/nodeMetrics';
import type { TreePosition } from '../../geometry/treeLayout';
import { CanvasNodeKind, ChangeKind, Theme } from '../../ui/theme';
import type { CanvasNode } from './types';

export const BORDER_WIDTH = 1;

export const CUSTOM_SHAPE = 'custom';

export function styled(
  id: string,
  kind: CanvasNodeKind,
  card: NodeCard,
  theme: Theme,
  level: number | undefined,
  seat: TreePosition | undefined,
  pinned: boolean,
  change?: ChangeKind,
): CanvasNode {
  const node: CanvasNode = {
    id,
    kind,
    shape: CUSTOM_SHAPE,
    fixed: false,
    physics: !pinned,
    borderWidth: change === undefined ? BORDER_WIDTH : HIGHLIGHT_WIDTH,
    card,
    metrics: nodeMetrics(card, kind, theme, false),
    metricsSelected: nodeMetrics(card, kind, theme, true),
    palette: theme.nodes[kind],
  };

  if (change !== undefined) {
    node.change = change;
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
