import React from 'react';
import type { LayoutChoice } from './layout';

const CHOICES: { value: LayoutChoice; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'physics', label: 'Em lista' },
  { value: 'hierarchical', label: 'Em árvore' },
];

const FUTURE = ['Recursão', 'Ordenação'];

export const ColumnButton: React.FC<{
  open: boolean;
  count: number;
  onToggle: (open: boolean) => void;
}> = ({ open, count, onToggle }) => (
  <button
    type="button"
    style={open ? { ...styles.square, ...styles.squareOn } : styles.square}
    aria-pressed={open}
    title={`${open ? 'Ocultar' : 'Mostrar'} as ${count} variáveis`}
    onClick={() => onToggle(!open)}
  >
    {count}
  </button>
);

const Toolbar: React.FC<{
  choice: LayoutChoice;
  onChoice: (choice: LayoutChoice) => void;
  nullTerminals: boolean;
  onNullTerminals: (enabled: boolean) => void;
}> = ({ choice, onChoice, nullTerminals, onNullTerminals }) => (
  <div style={styles.bar}>
    <select
      style={styles.select}
      value={choice}
      title="Como desenhar a estrutura"
      onChange={(event) => onChoice(event.target.value as LayoutChoice)}
    >
      {CHOICES.map((entry) => (
        <option key={entry.value} value={entry.value}>
          {entry.label}
        </option>
      ))}
      {FUTURE.map((label) => (
        <option key={label} value={label} disabled title="Ainda não disponível">
          {label}
        </option>
      ))}
    </select>

    <button
      type="button"
      style={nullTerminals ? { ...styles.button, ...styles.buttonOn } : styles.button}
      aria-pressed={nullTerminals}
      title="Desenhar os ponteiros nulos como terminais no grafo"
      onClick={() => onNullTerminals(!nullTerminals)}
    >
      NULL
    </button>
  </div>
);

const PANEL: React.CSSProperties = {
  position: 'absolute',
  zIndex: 2,
  backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
  border: '1px solid var(--vscode-editorWidget-border, #333)',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  fontFamily: 'var(--vscode-font-family, sans-serif)',
  fontSize: '12px',
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    ...PANEL,
    bottom: '8px',
    left: '8px',
    display: 'flex',
    gap: '4px',
    alignItems: 'stretch',
    padding: '4px',
  },
  square: {
    ...PANEL,
    top: '8px',
    left: '8px',
    width: '28px',
    height: '28px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--vscode-foreground, #ccc)',
    fontFamily: 'monospace',
  },
  squareOn: {
    backgroundColor: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    borderColor: 'var(--vscode-button-background, #0e639c)',
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
  button: {
    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: 'var(--vscode-button-secondaryForeground, #ccc)',
    border: 'none',
    borderRadius: '3px',
    padding: '2px 10px',
    fontFamily: 'monospace',
    fontSize: '12px',
    letterSpacing: '0.5px',
    cursor: 'pointer',
  },
  buttonOn: {
    background: 'var(--vscode-charts-green, #2ea043)',
    color: 'var(--vscode-editor-background, #101010)',
    fontWeight: 700,
  },
};

export default Toolbar;
