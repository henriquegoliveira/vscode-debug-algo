import * as l10n from '@vscode/l10n';
import { legendMark, styles } from './ChangeLegend.styles';
import { ChangeKind, Theme } from './theme';
import React from 'react';

export const ChangeLegend: React.FC<{ changes: Map<string, ChangeKind>; theme: Theme }> = ({
  changes,
  theme,
}) => {
  const names: Record<ChangeKind, string> = {
    created: l10n.t('created'),
    relinked: l10n.t('relinked'),
    valued: l10n.t('value changed'),
  };
  const tally = new Map<ChangeKind, number>();

  changes.forEach((kind) => tally.set(kind, (tally.get(kind) ?? 0) + 1));

  return (
    <>
      {(['created', 'relinked', 'valued'] as ChangeKind[])
        .filter((kind) => tally.has(kind))
        .map((kind) => (
          <span key={kind} style={styles.legend}>
            <span style={legendMark(kind, theme.change[kind])} />
            {names[kind]} {tally.get(kind)}
          </span>
        ))}
    </>
  );
};
