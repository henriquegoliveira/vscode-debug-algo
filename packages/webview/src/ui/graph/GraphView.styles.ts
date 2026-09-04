import { SECTION_TITLE } from '../chrome';
import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  column: {
    flex: '0 0 auto',
    overflowY: 'auto',
    padding: '10px',
    boxSizing: 'border-box',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--dbga-text-body)',
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
    boxShadow: 'var(--dbga-shadow-panel)',
  },
  dividerFloating: { position: 'absolute', zIndex: 3, top: 0, bottom: 0 },
  columnTitle: { ...SECTION_TITLE, margin: '0 0 10px 0' },
  frame: { marginBottom: '12px' },
  frameLevel: { color: 'var(--vscode-descriptionForeground, #a0a0a0)', fontWeight: 400 },
  roots: {
    marginLeft: '6px',
    paddingLeft: '2px',
    borderLeft: '1px solid var(--vscode-editorWidget-border, #333)',
  },
  root: {
    display: 'flex',
    gap: '6px',
    padding: '1px 4px 1px 8px',
    whiteSpace: 'nowrap',
    alignItems: 'baseline',
  },
  rootName: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  rootType: {
    color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
    opacity: 0.8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rootValue: { marginLeft: 'auto', color: 'var(--vscode-charts-green, #b5cea8)' },
  rootAddress: { marginLeft: 'auto', color: 'var(--vscode-charts-yellow, #dcdcaa)' },
  rootStatus: { marginLeft: 'auto', color: 'var(--vscode-charts-orange, #ce9178)' },
  canvas: { flex: 1, position: 'relative', minWidth: 0 },
  network: { position: 'absolute', inset: 0, outline: 'none' },
};
