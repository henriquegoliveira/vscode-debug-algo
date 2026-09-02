import { rootCell } from '../../model/graph/labels';
import type { FrameRoot } from '../../model/graph/types';
import { styles } from './RecursionView.styles';
import React from 'react';

export const RootLine: React.FC<{
  root: FrameRoot;
  changed: boolean;
  active: boolean;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ root, changed, active, onSelect }) => (
  <button
    type="button"
    className="dbga-row"
    aria-pressed={active}
    style={root.origin === 'parameter' ? styles.parameter : undefined}
    onClick={() => onSelect(root.id, true)}
  >
    <span style={styles.rootName}>{root.name}</span>
    <span style={changed ? { ...styles.rootValue, ...styles.rootChanged } : styles.rootValue}>
      {rootCell(root)}
    </span>
  </button>
);
