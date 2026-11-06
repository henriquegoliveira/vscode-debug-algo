import * as l10n from '@vscode/l10n';
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
    <h5 style={styles.sectionTitle}>{l10n.t('children of {0}', type)}</h5>
    <div style={styles.modeRow}>
      <span style={styles.rowName}>{sides.join(' · ')}</span>
      <button
        type="button"
        className="dbga-chip"
        aria-pressed={mirrored}
        onClick={() => onMirror(type)}
      >
        {l10n.t('mirror')}
      </button>
    </div>
    <div style={styles.annotateNote}>
      {embedded
        ? l10n.t(
            'Left to right. The mirror applies to every node of this type and is stored per debugged file.',
          )
        : l10n.t('Left to right. The browser is read-only: the mirror applies in this tab.')}
    </div>
  </section>
);
