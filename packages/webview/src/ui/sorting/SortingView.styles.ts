import { PANEL, PANEL_HEAD } from '../chrome';
import type { CSSProperties } from 'react';

export const CELL_HEIGHT = 24;

export const INDEX_HEIGHT = 14;

export const MARKER_HEIGHT = 18;

export const CUT_ROOM = 56;

export const styles: Record<string, CSSProperties> = {
  viewport: {
    flex: 1,
    position: 'relative',
    minWidth: 0,
    overflow: 'hidden',
    touchAction: 'none',
    cursor: 'grab',
  },
  stack: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: '0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '12px',
    width: 'max-content',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--dbga-text-body)',
  },
  empty: { padding: '12px', color: 'var(--vscode-descriptionForeground, #a0a0a0)' },
  track: {
    borderRadius: 'var(--dbga-radius-panel)',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #333)',
    boxShadow: 'var(--dbga-shadow-panel)',
    overflow: 'hidden',
  },
  trackHead: { ...PANEL_HEAD, padding: '3px 4px' },
  trackNames: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)', fontWeight: 600 },
  trackType: {
    color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
    opacity: 0.8,
  },
  trackTruncated: {
    marginLeft: 'auto',
    color: 'var(--vscode-charts-orange, #d7ba7d)',
    fontSize: 'var(--dbga-text-meta)',
  },
  trackBody: { padding: '8px 10px' },
  ribbon: { position: 'relative' },
  cell: {
    position: 'absolute',
    top: INDEX_HEIGHT,
    left: 0,
    height: CELL_HEIGHT - 4,
    lineHeight: `${CELL_HEIGHT - 14}px`,
    padding: '4px 2px',
    boxSizing: 'border-box',
    textAlign: 'center',
    borderRadius: '3px',
    backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
    border: '1px solid var(--vscode-editorWidget-border, #333)',
    color: 'var(--vscode-charts-green, #b5cea8)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'transform 320ms ease-in-out',
  },
  cellChanged: {
    borderColor: 'var(--vscode-editor-foreground, #d4d4d4)',
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
    fontWeight: 700,
  },
  cellIndex: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: INDEX_HEIGHT,
    textAlign: 'center',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontSize: 'var(--dbga-text-note)',
  },
  marker: {
    position: 'absolute',
    left: 0,
    height: MARKER_HEIGHT - 2,
    boxSizing: 'border-box',
    fontSize: 'var(--dbga-text-micro)',
    padding: '0 2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'transform 320ms ease-in-out, top 320ms ease-in-out',
  },
  cut: {
    position: 'absolute',
    top: INDEX_HEIGHT,
    left: 0,
    padding: '4px 6px',
    lineHeight: `${CELL_HEIGHT - 14}px`,
    color: 'var(--vscode-charts-orange, #d7ba7d)',
    fontSize: 'var(--dbga-text-micro)',
    whiteSpace: 'nowrap',
  },
  picker: {
    ...PANEL,
    top: '8px',
    left: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '5px',
    maxWidth: '45%',
  },
  pickerRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' },
  pickerLabel: {
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontSize: 'var(--dbga-text-meta)',
    minWidth: '68px',
  },
};
