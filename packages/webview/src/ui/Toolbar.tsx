import React, { useEffect, useRef, useState } from 'react';
import type { LayoutChoice } from '../model/layoutRule';
import type { FrameMode, ViewMode } from '../session/persistence';
import { ChevronIcon, FollowIcon, FrameIcon, LayoutIcon, NullIcon, StackIcon } from './icons';
import { styles } from './Toolbar.styles';

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
    <span className="dbga-sep" />
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

const DrawMenu: React.FC<{
  choice: LayoutChoice;
  viewMode: ViewMode;
  onGraphChoice: (choice: LayoutChoice) => void;
  onViewMode: (mode: ViewMode) => void;
}> = ({ choice, viewMode, onGraphChoice, onViewMode }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const current =
    MODES.find((entry) => entry.value === viewMode) ??
    (CHOICES.find((entry) => entry.value === choice) as { label: string });

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!(boxRef.current?.contains(event.target as Node) ?? false)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', onPointerDown);

    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const pick = (run: () => void): void => {
    run();
    setOpen(false);
  };

  return (
    <div
      ref={boxRef}
      style={styles.menuBox}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="dbga-pill"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Como desenhar a estrutura"
        onClick={() => setOpen(!open)}
      >
        <LayoutIcon />
        <span style={styles.pillLead}>Desenho:</span>
        <strong style={styles.pillValue}>{current.label}</strong>
        <ChevronIcon />
      </button>

      {open && (
        <div role="menu" style={styles.menu}>
          <div style={styles.menuTitle}>Grafo de ponteiros</div>
          {CHOICES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="menuitemradio"
              className="dbga-menuitem"
              aria-checked={viewMode === 'graph' && choice === entry.value}
              onClick={() => pick(() => onGraphChoice(entry.value))}
            >
              {entry.label}
            </button>
          ))}

          <div style={styles.menuGroup}>
            <div style={styles.menuTitle}>Outras visualizações</div>
            {MODES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="menuitemradio"
                className="dbga-menuitem"
                aria-checked={viewMode === entry.value}
                onClick={() => pick(() => onViewMode(entry.value))}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<{
  choice: LayoutChoice;
  onGraphChoice: (choice: LayoutChoice) => void;
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
  onGraphChoice,
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
    <DrawMenu
      choice={choice}
      viewMode={viewMode}
      onGraphChoice={onGraphChoice}
      onViewMode={onViewMode}
    />

    {viewMode !== 'recursion' && (
      <>
        <span className="dbga-sep" />

        <div className="dbga-segment" role="group" aria-label="Frames no grafo">
          <button
            type="button"
            className="dbga-chip"
            aria-pressed={!manual && frameMode === 'current'}
            title="Mostrar só o que vem do frame onde a execução parou"
            onClick={() => onFrameMode('current')}
          >
            <FrameIcon />
            {compact ? 'atual' : 'Frame atual'}
          </button>

          <button
            type="button"
            className="dbga-chip"
            aria-pressed={!manual && frameMode === 'all'}
            title="Mostrar o que vem de todos os frames"
            onClick={() => onFrameMode('all')}
          >
            <StackIcon />
            {compact ? 'todos' : 'Todos os frames'}
          </button>
        </div>
      </>
    )}

    {viewMode === 'graph' && (
      <>
        <span className="dbga-sep" />

        <button
          type="button"
          className="dbga-chip"
          aria-pressed={nullTerminals}
          title="Desenhar os ponteiros nulos como terminais no grafo"
          onClick={() => onNullTerminals(!nullTerminals)}
        >
          <NullIcon />
          {compact ? 'NULL' : 'Exibir nulos'}
        </button>

        <button
          type="button"
          className="dbga-chip"
          aria-pressed={follow}
          title="Trazer o canvas para o frame onde a execução parou a cada pausa"
          onClick={() => onFollow(!follow)}
        >
          <FollowIcon />
          {compact ? 'seguir' : 'Seguir execução'}
        </button>
      </>
    )}
  </div>
);
export default Toolbar;
