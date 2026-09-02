import type { GraphSnapshot, Root } from 'dbga-contract';
import { formatValue, valueKey } from './format';
import type { FrameRoot } from './graph/types';
import { nodeCanvasId, rootCanvasId, rootKey } from './graph/ids';

export interface FrameCard {
  level: number;
  function: string;
  file: string;
  line: number;
  roots: FrameRoot[];
  isCurrent: boolean;
  changedRoots: Set<string>;
}

export interface CallStackModel {
  frames: FrameCard[];
  globals: FrameRoot[];
  currentLevel: number;
}

export function callStackModel(
  snapshot: GraphSnapshot,
  previous?: GraphSnapshot | null,
): CallStackModel {
  const fingerprints =
    previous === null || previous === undefined
      ? null
      : new Map(previous.roots.map((root) => [rootKey(root), rootFingerprint(root)]));

  const globals: FrameRoot[] = [];
  const byLevel = new Map<number, Root[]>();

  snapshot.roots.forEach((root) => {
    if (root.origin === 'global') {
      globals.push(toFrameRoot(root));
      return;
    }

    const known = byLevel.get(root.frameLevel);
    if (known === undefined) {
      byLevel.set(root.frameLevel, [root]);
    } else {
      known.push(root);
    }
  });

  const frames: FrameCard[] = snapshot.frames.map((frame) => {
    const roots = byLevel.get(frame.level) ?? [];
    const changedRoots = new Set<string>();

    if (fingerprints !== null) {
      roots.forEach((root) => {
        const before = fingerprints.get(rootKey(root));

        if (before !== undefined && before !== rootFingerprint(root)) {
          changedRoots.add(rootCanvasId(root));
        }
      });
    }

    return {
      level: frame.level,
      function: frame.function,
      file: frame.file,
      line: frame.line,
      roots: roots.map(toFrameRoot),
      isCurrent: frame.level === 0,
      changedRoots,
    };
  });

  return { frames, globals, currentLevel: 0 };
}

function toFrameRoot(root: Root): FrameRoot {
  return {
    id: rootCanvasId(root),
    canvasId: root.node === null ? null : nodeCanvasId(root.node),
    target: root.target,
    name: root.name,
    type: root.type,
    origin: root.origin,
    category: root.category,
    status: root.status,
    value: formatValue(root.value),
  };
}

function rootFingerprint(root: Root): string {
  return `${root.status}|${valueKey(root.value)}`;
}
