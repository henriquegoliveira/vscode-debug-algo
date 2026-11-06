import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  pane: {
    position: 'relative',
    height: '100%',
    overflow: 'auto',
    backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 'var(--dbga-text-body)',
    lineHeight: '18px',
    fontVariantLigatures: 'none',
    padding: '8px 0',
  },
  line: { display: 'flex', whiteSpace: 'pre', paddingRight: '16px' },
  current: {
    display: 'flex',
    whiteSpace: 'pre',
    paddingRight: '16px',
    backgroundColor: 'var(--vscode-editor-stackFrameHighlightBackground, rgba(255, 255, 0, 0.2))',
  },
  gutter: {
    flexShrink: 0,
    width: '52px',
    paddingRight: '12px',
    textAlign: 'right',
    color: 'var(--vscode-editorLineNumber-foreground, #858585)',
  },
  arrow: { color: 'var(--vscode-debugIcon-continueForeground, #ffcc00)' },
  keyword: { color: 'var(--vscode-symbolIcon-keywordForeground, #569cd6)' },
  type: { color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)' },
  number: { color: 'var(--vscode-symbolIcon-numberForeground, #b5cea8)' },
  string: { color: 'var(--vscode-symbolIcon-stringForeground, #ce9178)' },
  comment: { color: 'var(--vscode-descriptionForeground, #6a9955)' },
  directive: { color: 'var(--vscode-symbolIcon-constantForeground, #c586c0)' },
};
