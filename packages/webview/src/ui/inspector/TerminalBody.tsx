import type { TerminalInspection } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import { Target } from './Entries';
import type { Select } from './types';
import React from 'react';

export const TerminalBody: React.FC<{ inspection: TerminalInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <div style={styles.address}>{inspection.originAddress}</div>
    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>{inspection.originType}</h5>
      <div style={styles.row}>
        <span style={styles.rowName}>from</span>
        <Target canvasId={inspection.originCanvasId} onSelect={onSelect} />
      </div>
      {inspection.fields.map((field) => (
        <div key={field} style={styles.row}>
          <span style={styles.rowName}>{field}</span>
          <span style={styles.rowNull}>NULL</span>
        </div>
      ))}
    </section>
  </>
);
