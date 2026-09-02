import type { CSSProperties } from 'react';

export const PANEL: CSSProperties = {
  position: 'absolute',
  zIndex: 2,
  backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
  border: '1px solid var(--vscode-editorWidget-border, #333)',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  fontFamily: 'var(--vscode-font-family, sans-serif)',
  fontSize: '12px',
};

export const styles: Record<string, CSSProperties> = {
  bar: {
    ...PANEL,
    bottom: '8px',
    left: '8px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'stretch',
    padding: '4px',
  },
  barCompact: { maxWidth: 'calc(100% - 148px)' },
  zoom: {
    ...PANEL,
    bottom: '8px',
    right: '8px',
    display: 'flex',
    alignItems: 'stretch',
    padding: '2px',
  },
  square: {
    ...PANEL,
    zIndex: 4,
    top: '8px',
    left: '8px',
    minWidth: '28px',
    height: '28px',
  },
  select: {
    background: 'var(--vscode-dropdown-background, #3c3c3c)',
    color: 'var(--vscode-dropdown-foreground, #ccc)',
    border: '1px solid var(--vscode-dropdown-border, #3c3c3c)',
    borderRadius: '3px',
    padding: '2px 4px',
    font: 'inherit',
    cursor: 'pointer',
  },
};
