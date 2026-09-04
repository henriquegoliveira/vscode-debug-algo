import type { CSSProperties } from 'react';

export const PANEL: CSSProperties = {
  position: 'absolute',
  zIndex: 2,
  backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
  border: '1px solid var(--vscode-editorWidget-border, #333)',
  borderRadius: 'var(--dbga-radius-panel)',
  boxShadow: 'var(--dbga-shadow-panel)',
  fontFamily: 'var(--vscode-font-family, sans-serif)',
  fontSize: 'var(--dbga-text-body)',
};

export const PANEL_HEAD: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  borderBottom: '1px solid var(--vscode-editorWidget-border, #333)',
  backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
};

export const SECTION_TITLE: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--vscode-font-family, sans-serif)',
  fontSize: 'var(--dbga-text-meta)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--vscode-descriptionForeground, #a0a0a0)',
};
