import * as l10n from '@vscode/l10n';
import type { ArrayView } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import { Target } from './Entries';
import type { Select } from './types';
import React from 'react';

export const ArraySection: React.FC<{ array: ArrayView; onSelect: Select }> = ({
  array,
  onSelect,
}) => (
  <section style={styles.section}>
    <h5 style={styles.sectionTitle}>
      {array.name}[{array.length}] <span style={styles.rowType}>{array.elementType}</span>
    </h5>

    {array.state === 'unexpanded' && <div style={styles.warn}>{l10n.t('array not expanded')}</div>}

    {array.state !== 'unexpanded' && (
      <div style={styles.columnsRow}>
        <span>{l10n.t('index')}</span>
        <span style={styles.columnsRight}>
          {array.state === 'cells' ? l10n.t('value') : l10n.t('points to')}
        </span>
      </div>
    )}

    {array.state === 'cells' &&
      array.cells.map((cell) => (
        <div key={cell.index} style={styles.row}>
          <span style={styles.rowIndex}>[{cell.index}]</span>
          <span style={styles.rowValue}>{cell.text}</span>
        </div>
      ))}

    {array.state === 'pointers' &&
      array.targets.map((target) => (
        <div key={target.index} style={styles.row}>
          <span style={styles.rowIndex}>[{target.index}]</span>
          <Target canvasId={target.canvasId} onSelect={onSelect} />
        </div>
      ))}

    {array.truncated && (
      <div style={styles.warn}>{l10n.t('array truncated at the cell limit')}</div>
    )}
  </section>
);
