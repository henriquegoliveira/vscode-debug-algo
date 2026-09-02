import React from 'react';
import type { LayoutChoice } from '../model/layout';
import type { FrameMode, ViewMode } from '../session/persistence';

export const ZOOM_STEP = 1.25;

const CHOICES: { value: LayoutChoice; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'physics', label: 'Em lista' },
  { value: 'hierarchical', label: 'Em árvore' },
];

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'recursion', label: 'Recursão' },
  { value: 'sorting', label: 'Ordenação' },
];

export const ColumnButton: React.FC<{
  open: boolean;
  shown: number;
  total: number;
  offset: number;
  onToggle: (open: boolean) => void;
}> = ({ open, shown, total, offset, onToggle }) => (
  <button
    type="button"
    className="dbga-square"
    style={offset === 0 ? styles.square : { ...styles.square, left: `${offset}px` }}
    aria-pressed={open}
    title={
      shown === total
        ? `${open ? 'Ocultar' : 'Mostrar'} as ${total} variáveis`
        : `${open ? 'Ocultar' : 'Mostrar'} a coluna — ${shown} de ${total} variáveis no grafo`
    }
    onClick={() => onToggle(!open)}
  >
    {shown === total ? total : `${shown}/${total}`}
  </button>
);

export const ZoomControl: React.FC<{
  scale: number;
  onStep: (direction: number) => void;
  onReset: () => void;
  onFit: () => void;
  onFocus: () => void;
  canFocus: boolean;
}> = ({ scale, onStep, onReset, onFit, onFocus, canFocus }) => (
  <div style={styles.zoom}>
    <button type="button" className="dbga-zoom" title="Afastar" onClick={() => onStep(-1)}>
      &minus;
    </button>
    <button
      type="button"
      className="dbga-zoom dbga-zoom-label"
      title="Voltar ao tamanho natural"
      onClick={onReset}
    >
      {Math.round(scale * 100)}%
    </button>
    <button type="button" className="dbga-zoom" title="Aproximar" onClick={() => onStep(1)}>
      +
    </button>
    <button type="button" className="dbga-zoom" title="Enquadrar o grafo inteiro" onClick={onFit}>
      &#9974;
    </button>
    <button
      type="button"
      className="dbga-zoom"
      disabled={!canFocus}
      title={
        canFocus ? 'Ir até o que mudou nesta pausa' : 'Nada mudou nesta pausa que esteja no grafo'
      }
      onClick={onFocus}
    >
      &#8982;
    </button>
  </div>
);

const Toolbar: React.FC<{
  choice: LayoutChoice;
  onChoice: (choice: LayoutChoice) => void;
  nullTerminals: boolean;
  onNullTerminals: (enabled: boolean) => void;
  frameMode: FrameMode;
  manual: boolean;
  onFrameMode: (mode: FrameMode) => void;
  follow: boolean;
  onFollow: (enabled: boolean) => void;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  compact: boolean;
}> = ({
  choice,
  onChoice,
  nullTerminals,
  onNullTerminals,
  frameMode,
  manual,
  onFrameMode,
  follow,
  onFollow,
  viewMode,
  onViewMode,
  compact,
}) => (
  <div style={compact ? { ...styles.bar, ...styles.barCompact } : styles.bar}>
    <select
      style={styles.select}
      value={viewMode === 'graph' ? choice : viewMode}
      title="Como desenhar a estrutura"
      onChange={(event) => {
        const value = event.target.value;
        const mode = MODES.find((entry) => entry.value === value);

        if (mode !== undefined) {
          onViewMode(mode.value);
          return;
        }

        onViewMode('graph');
        onChoice(value as LayoutChoice);
      }}
    >
      {CHOICES.map((entry) => (
        <option key={entry.value} value={entry.value}>
          {entry.label}
        </option>
      ))}
      {MODES.map((entry) => (
        <option key={entry.value} value={entry.value}>
          {entry.label}
        </option>
      ))}
    </select>

    {viewMode !== 'recursion' && (
      <>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={!manual && frameMode === 'current'}
          title="Mostrar só o que vem do frame onde a execução parou"
          onClick={() => onFrameMode('current')}
        >
          atual
        </button>

        <button
          type="button"
          className="dbga-chip"
          aria-pressed={!manual && frameMode === 'all'}
          title="Mostrar o que vem de todos os frames"
          onClick={() => onFrameMode('all')}
        >
          todos
        </button>
      </>
    )}

    {viewMode === 'graph' && (
      <>
        <button
          type="button"
          className="dbga-chip"
          aria-pressed={nullTerminals}
          title="Desenhar os ponteiros nulos como terminais no grafo"
          onClick={() => onNullTerminals(!nullTerminals)}
        >
          NULL
        </button>

        <button
          type="button"
          className="dbga-chip"
          aria-pressed={follow}
          title="Trazer o canvas para o frame onde a execução parou a cada pausa"
          onClick={() => onFollow(!follow)}
        >
          seguir
        </button>
      </>
    )}
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

export default Toolbar;
