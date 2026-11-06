import * as l10n from '@vscode/l10n';
import type { AnnotationTarget } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import React, { useState } from 'react';

export const AnnotateSection: React.FC<{
  targets: AnnotationTarget[];
  embedded: boolean;
  onAnnotate: (annotation: string) => boolean;
}> = ({ targets, embedded, onAnnotate }) => {
  const [path, setPath] = useState(targets[0].path);
  const [size, setSize] = useState('');

  const length = size.trim();
  const ready = embedded && length.length > 0;

  const submit = (): void => {
    if (ready) {
      onAnnotate(`${path}@${length}`);
    }
  };

  return (
    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>{l10n.t('read pointer as array')}</h5>

      <div style={styles.annotateNote}>
        {l10n.t(
          'A pointer does not carry its length, so the extractor draws a single element. Say how many were allocated and it draws the whole array.',
        )}
      </div>

      {targets.length > 1 ? (
        <select
          style={styles.annotateSelect}
          value={path}
          disabled={!embedded}
          onChange={(event) => setPath(event.target.value)}
        >
          {targets.map((target) => (
            <option key={target.path} value={target.path}>
              {target.label}
            </option>
          ))}
        </select>
      ) : (
        <div style={styles.annotatePath}>{targets[0].label}</div>
      )}

      <div style={styles.annotateRow}>
        <input
          style={styles.annotateInput}
          value={size}
          disabled={!embedded}
          placeholder={l10n.t('how many elements')}
          onChange={(event) => setSize(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit();
            }
          }}
        />
        <button type="button" style={styles.annotateButton} disabled={!ready} onClick={submit}>
          {l10n.t('Annotate')}
        </button>
      </div>

      <div style={styles.annotateNote}>
        {embedded
          ? l10n.t('A number, or the name of the variable that holds the size.')
          : l10n.t(
              'The browser is read-only: the annotation only takes effect from the VS Code panel.',
            )}
      </div>
    </section>
  );
};
