import * as l10n from '@vscode/l10n';
import type { CardInspection } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import { Target } from './Entries';
import type { Select } from './types';
import React from 'react';

export const CardBody: React.FC<{ inspection: CardInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>{l10n.t('variables')}</h5>
      {inspection.variables.map((variable) => (
        <div key={variable.canvasId} style={styles.row}>
          <span style={styles.rowName}>{variable.name}</span>
          <span style={styles.rowType}>{variable.frame}</span>
          <button type="button" style={styles.link} onClick={() => onSelect(variable.canvasId)}>
            {variable.status === 'ok' ? l10n.t('detail') : variable.status}
          </button>
        </div>
      ))}
    </section>

    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>node</h5>
      <div style={styles.row}>
        <Target canvasId={inspection.nodeCanvasId} onSelect={onSelect} />
      </div>
    </section>
  </>
);
