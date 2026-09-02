import { rootCell } from '../../model/graph/labels';
import { FrameRoot } from '../../model/graph/types';
import { styles } from './GraphView.styles';
import React from 'react';

export const RootRow: React.FC<{
  root: FrameRoot;
  active: boolean;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ root, active, onSelect }) => {
  const cell = rootCell(root);
  const body = (
    <>
      <span style={styles.rootName}>{root.name}</span>
      <span style={styles.rootType}>{root.type}</span>
      <span style={root.status === 'ok' ? styles.rootValue : styles.rootStatus}>{cell}</span>
    </>
  );

  if (root.canvasId === null) {
    return <div style={styles.root}>{body}</div>;
  }

  return (
    <button
      type="button"
      className="dbga-row"
      aria-pressed={active}
      onClick={() => onSelect(root.id, true)}
    >
      {body}
    </button>
  );
};
