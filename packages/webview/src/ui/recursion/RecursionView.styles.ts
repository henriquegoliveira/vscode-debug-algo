import type { RootInk } from '../../model/graph/labels';
import { PANEL_HEAD } from '../chrome';
import type { CSSProperties } from 'react';

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
    alignItems: 'center',
    width: 'max-content',
    padding: '12px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--dbga-text-body)',
  },
  card: {
    minWidth: '248px',
    borderRadius: 'var(--dbga-radius-panel)',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #333)',
    boxShadow: 'var(--dbga-shadow-panel)',
    overflow: 'hidden',
  },
  cardCurrent: {
    borderColor: 'var(--vscode-focusBorder, #007fd4)',
    boxShadow: 'inset 0 0 0 1px var(--vscode-focusBorder, #007fd4), var(--dbga-shadow-panel)',
  },
  cardHead: { ...PANEL_HEAD, gap: '6px' },
  cardFunction: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardLevel: {
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontSize: 'var(--dbga-text-meta)',
  },
  cardSite: {
    marginLeft: 'auto',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontSize: 'var(--dbga-text-meta)',
    whiteSpace: 'nowrap',
  },
  cardBody: { padding: '5px 4px' },
  cardEmpty: {
    padding: '1px 8px',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontStyle: 'italic',
  },
  parameter: { fontStyle: 'italic' },
  rootName: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  rootType: {
    color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
    opacity: 0.8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rootChanged: { color: 'var(--vscode-editor-foreground, #d4d4d4)', fontWeight: 700 },
  connector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    padding: '5px 0',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontSize: 'var(--dbga-text-micro)',
  },
  connectorLine: {
    width: '1px',
    height: '10px',
    backgroundColor: 'var(--vscode-charts-lines, #9a9a9a)',
  },
  connectorLabel: { whiteSpace: 'nowrap' },
};

export const rootInkStyles: Record<RootInk, CSSProperties> = {
  value: { marginLeft: 'auto', color: 'var(--vscode-charts-green, #b5cea8)' },
  address: { marginLeft: 'auto', color: 'var(--vscode-charts-yellow, #dcdcaa)' },
  null: { marginLeft: 'auto', color: 'var(--vscode-descriptionForeground, #a0a0a0)' },
  status: { marginLeft: 'auto', color: 'var(--vscode-charts-orange, #ce9178)' },
};
