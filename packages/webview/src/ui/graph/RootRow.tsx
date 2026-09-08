import { rootCell, rootInk } from '../../model/graph/labels';
import { FrameRoot } from '../../model/graph/types';
import { rootInkStyles, styles } from './GraphView.styles';
import React from 'react';

export const RootRow: React.FC<{
  root: FrameRoot;
  active: boolean;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ root, active, onSelect }) => {
  const body = (
    <>
      <span style={styles.rootName}>{root.name}</span>
      <span style={styles.rootType}>{root.type}</span>
      <span style={rootInkStyles[rootInk(root)]}>{rootCell(root)}</span>
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
