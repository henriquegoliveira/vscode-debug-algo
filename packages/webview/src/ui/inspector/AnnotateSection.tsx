import type { Inspection } from '../../model/inspection';
import { styles } from './InspectorOverlay.styles';
import React, { useState } from 'react';

export const AnnotateSection: React.FC<{
  prefill: string;
  embedded: boolean;
  onAnnotate: (annotation: string) => boolean;
}> = ({ prefill, embedded, onAnnotate }) => {
  const [draft, setDraft] = useState(prefill);

  const submit = (): void => {
    const annotation = draft.trim();

    if (annotation.length > 0) {
      onAnnotate(annotation);
    }
  };

  return (
    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>anotar vetor dinâmico</h5>
      <div style={styles.annotateRow}>
        <input
          style={styles.annotateInput}
          value={draft}
          disabled={!embedded}
          placeholder="caminho@tamanho"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit();
            }
          }}
        />
        <button type="button" style={styles.annotateButton} disabled={!embedded} onClick={submit}>
          Anotar
        </button>
      </div>
      {!embedded && (
        <div style={styles.annotateNote}>
          O navegador é somente leitura: a anotação só vale pelo painel do VS Code.
        </div>
      )}
    </section>
  );
};

export function annotationPrefill(inspection: Inspection): string {
  return inspection.space === 'root' ? `${inspection.name}@` : '';
}
