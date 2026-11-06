import * as l10n from '@vscode/l10n';
import type { Inspection, NodeInspection } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import { ArraySection } from './ArraySection';
import { MetaBlock, Target } from './Entries';
import type { Select } from './types';
import React from 'react';

export function heading(inspection: Inspection): string {
  if (inspection.space === 'node') {
    return inspection.title;
  }
  if (inspection.space === 'terminal') {
    return 'NULL';
  }
  if (inspection.space === 'card') {
    return inspection.variables.map((variable) => variable.name).join(', ');
  }

  return inspection.name;
}

export const NodeBody: React.FC<{ inspection: NodeInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <MetaBlock address={inspection.address} entries={inspection.entries} />

    {inspection.uncertain && (
      <div style={styles.warn}>{l10n.t('union: the active member is uncertain')}</div>
    )}

    {inspection.errors.map((error, position) => (
      <div key={position} style={styles.warn}>
        {error.message}
      </div>
    ))}

    {inspection.fields.length > 0 && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>fields</h5>
        {inspection.fields.map((field) => (
          <div key={field.name} style={styles.row}>
            <span style={styles.rowName}>{field.name}</span>
            <span style={styles.rowType}>{field.type}</span>
            <span style={styles.rowValue}>{field.value}</span>
          </div>
        ))}
      </section>
    )}

    {inspection.pointers.length > 0 && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>pointers</h5>
        {inspection.pointers.map((pointer) => (
          <div key={pointer.field} style={styles.row}>
            <span style={styles.rowName}>{pointer.field}</span>
            <span style={styles.rowType}>{pointer.type}</span>
            <Target canvasId={pointer.canvasId} onSelect={onSelect} />
          </div>
        ))}
      </section>
    )}

    {inspection.arrays.map((array) => (
      <ArraySection key={array.name} array={array} onSelect={onSelect} />
    ))}
  </>
);
