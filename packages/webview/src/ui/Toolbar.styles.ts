import { PANEL } from './chrome';
import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  bar: {
    ...PANEL,
    bottom: '8px',
    left: '8px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'center',
    padding: '5px',
  },
  barCompact: { maxWidth: 'calc(100% - 148px)' },
  zoom: {
    ...PANEL,
    bottom: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '3px',
  },
  square: {
    ...PANEL,
    zIndex: 4,
    top: '8px',
    left: '8px',
    minWidth: '26px',
    height: '26px',
  },
  select: {
    background: 'var(--vscode-dropdown-background, #3c3c3c)',
    color: 'var(--vscode-dropdown-foreground, #ccc)',
    border: '1px solid var(--vscode-dropdown-border, #3c3c3c)',
    borderRadius: 'var(--dbga-radius-control)',
    padding: '3px 6px',
    fontFamily: 'inherit',
    fontSize: 'var(--dbga-text-meta)',
    cursor: 'pointer',
  },
};
