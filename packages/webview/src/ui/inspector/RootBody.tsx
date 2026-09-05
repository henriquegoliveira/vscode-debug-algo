import type { RootInspection } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import { MetaBlock, Target } from './Entries';
import type { Select } from './types';
import React from 'react';

export const RootBody: React.FC<{ inspection: RootInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <MetaBlock address={inspection.frame} entries={inspection.entries} />

    {inspection.value !== null && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>value</h5>
        <div style={styles.row}>
          <span style={styles.rowValue}>{inspection.value}</span>
        </div>
      </section>
    )}

    {inspection.nodeCanvasId !== null && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>node</h5>
        <div style={styles.row}>
          <Target canvasId={inspection.nodeCanvasId} onSelect={onSelect} />
        </div>
      </section>
    )}
  </>
);
