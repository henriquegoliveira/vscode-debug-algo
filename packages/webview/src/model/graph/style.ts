import { HIGHLIGHT_WIDTH } from '../../geometry/arrows';
import type { TreePosition } from '../../geometry/treeLayout';
import { CanvasNodeKind, ChangeKind, Theme } from '../../ui/theme';
import type { CanvasNode } from './types';

export const BORDER_WIDTH = 1;

const NODE_SHAPE: Record<CanvasNodeKind, string> = {
  record: 'box',
  array: 'database',
  opaque: 'box',
  null: 'dot',
  root: 'ellipse',
  rootDegraded: 'ellipse',
};

export function styled(
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
