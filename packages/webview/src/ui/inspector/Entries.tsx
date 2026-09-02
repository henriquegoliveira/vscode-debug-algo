import type { Entry } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import type { Select } from './types';
import React from 'react';

export const Entries: React.FC<{ entries: Entry[] }> = ({ entries }) => (
  <section style={styles.section}>
    {entries.map((entry) => (
      <div key={entry.label} style={styles.row}>
        <span style={styles.rowName}>{entry.label}</span>
        <span style={styles.rowValue}>{entry.value}</span>
      </div>
    ))}
  </section>
);

export const Target: React.FC<{ canvasId: string | null; onSelect: Select }> = ({
  canvasId,
  onSelect,
}) =>
  canvasId === null ? (
    <span style={styles.rowNull}>NULL</span>
  ) : (
    <button type="button" style={styles.link} onClick={() => onSelect(canvasId)}>
      {canvasId}
    </button>
  );
