import type { FieldChoice } from '../../session/persistence';
import { styles } from './InspectorOverlay.styles';
import React from 'react';

export const LabelFields: React.FC<{
  type: string;
  names: string[];
  auto: string[];
  choice: FieldChoice | undefined;
  embedded: boolean;
  onChoice: (type: string, choice: FieldChoice | undefined) => void;
}> = ({ type, names, auto, choice, embedded, onChoice }) => {
  const shown = (name: string): boolean => {
    if (choice === undefined) {
      return auto.includes(name);
    }
    if (choice === 'all') {
      return true;
    }
    if (choice === 'none') {
      return false;
    }

    return choice.includes(name);
  };

  const toggle = (name: string): void => {
    const current = names.filter(shown);
    const next = current.includes(name)
      ? current.filter((entry) => entry !== name)
      : names.filter((entry) => entry === name || current.includes(entry));

    onChoice(type, next);
  };

  return (
    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>campos no rótulo de {type}</h5>
      <div style={styles.modeRow}>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={choice === undefined}
          onClick={() => onChoice(type, undefined)}
        >
          automático
        </button>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={choice === 'all'}
          onClick={() => onChoice(type, 'all')}
        >
          todos
        </button>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={choice === 'none'}
          onClick={() => onChoice(type, 'none')}
        >
          nenhum
        </button>
      </div>
      {names.map((name) => (
        <button
          key={name}
          type="button"
          className="dbga-check"
          aria-pressed={shown(name)}
          onClick={() => toggle(name)}
        >
          <span style={styles.rowIndex}>{shown(name) ? '\u2611' : '\u2610'}</span>
          <span style={styles.rowName}>{name}</span>
        </button>
      ))}
      <div style={styles.annotateNote}>
        {embedded
          ? 'A escolha vale para todo nó deste tipo e é guardada por arquivo depurado.'
          : 'O navegador é somente leitura: a escolha vale nesta aba e não vai para as settings.'}
      </div>
    </section>
  );
};
