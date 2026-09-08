import { rootCell, rootInk } from '../../model/graph/labels';
import type { FrameRoot } from '../../model/graph/types';
import { rootInkStyles, styles } from './RecursionView.styles';
import React from 'react';

export const RootLine: React.FC<{
  root: FrameRoot;
  changed: boolean;
  active: boolean;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ root, changed, active, onSelect }) => {
  const cell = rootInkStyles[rootInk(root)];

  return (
    <button
      type="button"
      className="dbga-row"
      aria-pressed={active}
      onClick={() => onSelect(root.id, true)}
    >
      <span
        style={
          root.origin === 'parameter'
            ? { ...styles.rootName, ...styles.parameter }
            : styles.rootName
        }
      >
        {root.name}
      </span>
      <span style={styles.rootType}>{root.type}</span>
      <span style={changed ? { ...cell, ...styles.rootChanged } : cell}>{rootCell(root)}</span>
    </button>
  );
};
