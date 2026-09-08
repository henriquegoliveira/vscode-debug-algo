import type { FrameCard } from '../../model/callStack';
import { styles } from './RecursionView.styles';
import { RootLine } from './RootLine';
import React from 'react';

export const FrameCardView: React.FC<{
  frame: FrameCard;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  cardRef: (el: HTMLDivElement | null) => void;
}> = ({ frame, selectedId, onSelect, cardRef }) => (
  <div
    ref={cardRef}
    style={frame.isCurrent ? { ...styles.card, ...styles.cardCurrent } : styles.card}
  >
    <div style={styles.cardHead}>
      <span style={styles.cardFunction}>{frame.function}</span>
      <span style={styles.cardLevel}>#{frame.level}</span>
      <span style={styles.cardSite}>
        {frame.file === '' ? `linha ${frame.line}` : `${frame.file}:${frame.line}`}
      </span>
    </div>
    <div style={styles.cardBody}>
      {frame.roots.map((root) => (
        <RootLine
          key={root.id}
          root={root}
          changed={frame.changedRoots.has(root.id)}
          active={root.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      {frame.roots.length === 0 && <div style={styles.cardEmpty}>sem variáveis</div>}
    </div>
  </div>
);
