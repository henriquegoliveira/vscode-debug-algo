import { styles } from './InspectorOverlay.styles';
import React from 'react';

export const ChildSides: React.FC<{
  type: string;
  sides: string[];
  mirrored: boolean;
  embedded: boolean;
  onMirror: (type: string) => void;
}> = ({ type, sides, mirrored, embedded, onMirror }) => (
  <section style={styles.section}>
    <h5 style={styles.sectionTitle}>filhos de {type}</h5>
    <div style={styles.modeRow}>
      <span style={styles.rowName}>{sides.join(' · ')}</span>
      <button
        type="button"
        className="dbga-chip"
        aria-pressed={mirrored}
        onClick={() => onMirror(type)}
      >
        espelhar
      </button>
    </div>
    <div style={styles.annotateNote}>
      {embedded
        ? 'Da esquerda para a direita. O espelho vale para todo nó deste tipo e é guardado por arquivo depurado.'
        : 'Da esquerda para a direita. O navegador é somente leitura: o espelho vale nesta aba.'}
    </div>
  </section>
);
