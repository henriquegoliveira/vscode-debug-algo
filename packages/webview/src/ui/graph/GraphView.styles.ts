import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  column: {
    flex: '0 0 auto',
    overflowY: 'auto',
    padding: '8px 10px',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  divider: {
    flex: '0 0 auto',
    width: '5px',
    cursor: 'col-resize',
    backgroundColor: 'var(--vscode-editorWidget-border, #333)',
  },
  columnFloating: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    borderRight: '1px solid var(--vscode-editorWidget-border, #333)',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.35)',
  },
  dividerFloating: { position: 'absolute', zIndex: 3, top: 0, bottom: 0 },
  columnTitle: { margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 },
  frame: { marginBottom: '10px' },
  root: {
    display: 'flex',
    gap: '6px',
    paddingLeft: '8px',
    whiteSpace: 'nowrap',
    alignItems: 'baseline',
  },
  rootName: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  rootType: { opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis' },
  rootValue: { marginLeft: 'auto', color: 'var(--vscode-charts-green, #b5cea8)' },
  rootStatus: { marginLeft: 'auto', color: 'var(--vscode-charts-orange, #ce9178)' },
  canvas: { flex: 1, position: 'relative', minWidth: 0 },
  network: { position: 'absolute', inset: 0, outline: 'none' },
};
