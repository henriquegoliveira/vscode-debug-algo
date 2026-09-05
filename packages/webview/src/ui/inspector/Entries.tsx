import { parseCanvasId } from '../../model/graph/ids';
import type { Entry } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import type { Select } from './types';
import React from 'react';

export const MetaBlock: React.FC<{ address: string; entries: Entry[] }> = ({
  address,
  entries,
}) => (
  <section style={styles.meta}>
    <div style={styles.address}>{address}</div>
    {entries.map((entry) => (
      <div key={entry.label} style={styles.row}>
        <span style={styles.rowLabel}>{entry.label}</span>
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
      {parseCanvasId(canvasId)?.address ?? canvasId}
    </button>
  );
