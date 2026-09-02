import { styles } from './ChangeLegend.styles';
import { ChangeKind, Theme } from './theme';
import React from 'react';

const CHANGE_NAMES: Record<ChangeKind, string> = {
  created: 'criado',
  relinked: 'religado',
  valued: 'valor alterado',
};

export const ChangeLegend: React.FC<{ changes: Map<string, ChangeKind>; theme: Theme }> = ({
  changes,
  theme,
}) => {
  const tally = new Map<ChangeKind, number>();

  changes.forEach((kind) => tally.set(kind, (tally.get(kind) ?? 0) + 1));

  return (
    <>
      {(['created', 'relinked', 'valued'] as ChangeKind[])
        .filter((kind) => tally.has(kind))
        .map((kind) => (
          <span key={kind} style={styles.legend}>
            <span style={{ ...styles.legendDot, backgroundColor: theme.change[kind] }} />
            {CHANGE_NAMES[kind]} {tally.get(kind)}
          </span>
        ))}
    </>
  );
};
