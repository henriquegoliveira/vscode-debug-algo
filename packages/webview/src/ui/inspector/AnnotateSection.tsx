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
      <h5 style={styles.sectionTitle}>ler ponteiro como vetor</h5>

      <div style={styles.annotateNote}>
        Um ponteiro não carrega o comprimento, então o extrator desenha um elemento só. Diga quantos
        foram alocados e ele desenha o vetor inteiro.
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
          placeholder="quantos elementos"
          onChange={(event) => setSize(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit();
            }
          }}
        />
        <button type="button" style={styles.annotateButton} disabled={!ready} onClick={submit}>
          Anotar
        </button>
      </div>

      <div style={styles.annotateNote}>
        {embedded
          ? 'Um número, ou o nome da variável que guarda o tamanho.'
          : 'O navegador é somente leitura: a anotação só vale pelo painel do VS Code.'}
      </div>
    </section>
  );
};
