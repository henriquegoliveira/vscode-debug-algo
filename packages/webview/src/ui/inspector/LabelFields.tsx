import * as l10n from '@vscode/l10n';
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
      <h5 style={styles.sectionTitle}>{l10n.t('fields in the {0} label', type)}</h5>
      <div style={styles.modeRow}>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={choice === undefined}
          onClick={() => onChoice(type, undefined)}
        >
          {l10n.t('automatic')}
        </button>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={choice === 'all'}
          onClick={() => onChoice(type, 'all')}
        >
          {l10n.t('all')}
        </button>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={choice === 'none'}
          onClick={() => onChoice(type, 'none')}
        >
          {l10n.t('none')}
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
          <span className="dbga-box" />
          <span style={styles.rowName}>{name}</span>
        </button>
      ))}
      <div style={styles.annotateNote}>
        {embedded
          ? l10n.t('The choice applies to every node of this type and is stored per debugged file.')
          : l10n.t(
              'The browser is read-only: the choice applies in this tab and is not written to the settings.',
            )}
      </div>
    </section>
  );
};
