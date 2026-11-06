import { DOCK, PANEL } from './chrome';
import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  bar: {
    ...DOCK,
    zIndex: 5,
    left: '8px',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '3px 5px',
  },
  barCompact: { maxWidth: 'calc(100% - 148px)' },
  zoom: {
    ...DOCK,
    right: '8px',
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
  menuBox: { position: 'relative', display: 'flex' },
  pillLead: { color: 'var(--vscode-descriptionForeground, #a0a0a0)' },
  pillIcon: { width: '20px', height: '20px', flexShrink: 0 },
  pillValue: { color: 'var(--vscode-charts-blue, #569cd6)', fontWeight: 600 },
  menu: {
    position: 'absolute',
    zIndex: 5,
    bottom: 'calc(100% + 6px)',
    left: 0,
    minWidth: '180px',
    padding: '4px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #333)',
    borderRadius: 'var(--dbga-radius-panel)',
    boxShadow: 'var(--dbga-shadow-panel)',
  },
  menuTitle: {
    padding: '3px 10px 4px 10px',
    fontSize: 'var(--dbga-text-micro)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.09em',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
  },
  menuGroup: {
    marginTop: '5px',
    paddingTop: '4px',
    borderTop: '1px solid var(--vscode-editorWidget-border, #333)',
  },
};
