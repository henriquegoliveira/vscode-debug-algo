import type { FrameRoot } from '../../model/graph/types';
import { styles } from './RecursionView.styles';
import { RootLine } from './RootLine';
import React from 'react';

export const GlobalsCardView: React.FC<{
  roots: FrameRoot[];
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ roots, selectedId, onSelect }) => (
  <div style={styles.card}>
    <div style={styles.cardHead}>
      <span style={styles.cardFunction}>Globais do arquivo</span>
    </div>
    <div style={styles.cardBody}>
      {roots.map((root) => (
        <RootLine
          key={root.id}
          root={root}
          changed={false}
          active={root.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  </div>
);
