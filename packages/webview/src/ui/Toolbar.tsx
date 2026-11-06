import * as l10n from '@vscode/l10n';
import React, { useEffect, useRef, useState } from 'react';
import type { LayoutChoice, LayoutKind } from '../model/layoutRule';
import type { FrameMode, ViewMode } from '../session/persistence';
import { ChevronIcon, FollowIcon, FrameIcon, NullIcon, StackIcon } from './icons';
import { viewIcon } from './viewIcon';
import { styles } from './Toolbar.styles';

export const ZOOM_STEP = 1.25;

const choices = (): { value: LayoutChoice; label: string }[] => [
  { value: 'auto', label: l10n.t('Automatic') },
  { value: 'physics', label: l10n.t('As a list') },
  { value: 'hierarchical', label: l10n.t('As a tree') },
];

const modes = (): { value: ViewMode; label: string }[] => [
  { value: 'recursion', label: l10n.t('Recursion') },
  { value: 'sorting', label: l10n.t('Sorting') },
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
        ? open
          ? l10n.t('Hide the {0} variables', total)
          : l10n.t('Show the {0} variables', total)
        : open
          ? l10n.t('Hide the column — {0} of {1} variables in the graph', shown, total)
          : l10n.t('Show the column — {0} of {1} variables in the graph', shown, total)
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
    <button
      type="button"
      className="dbga-zoom"
      title={l10n.t('Zoom out')}
      onClick={() => onStep(-1)}
    >
      &minus;
    </button>
    <button
      type="button"
      className="dbga-zoom dbga-zoom-label"
      title={l10n.t('Back to natural size')}
      onClick={onReset}
    >
      {Math.round(scale * 100)}%
    </button>
    <button type="button" className="dbga-zoom" title={l10n.t('Zoom in')} onClick={() => onStep(1)}>
      +
    </button>
    <span className="dbga-sep" />
    <button
      type="button"
      className="dbga-zoom"
      title={l10n.t('Fit the whole graph')}
      onClick={onFit}
    >
      &#9974;
    </button>
    <button
      type="button"
      className="dbga-zoom"
      disabled={!canFocus}
      title={
        canFocus
          ? l10n.t('Go to what changed at this pause')
          : l10n.t('Nothing that changed at this pause is in the graph')
      }
      onClick={onFocus}
    >
      &#8982;
    </button>
  </div>
);

const DrawMenu: React.FC<{
  choice: LayoutChoice;
  layout: LayoutKind | null;
  viewMode: ViewMode;
  onGraphChoice: (choice: LayoutChoice) => void;
  onViewMode: (mode: ViewMode) => void;
}> = ({ choice, layout, viewMode, onGraphChoice, onViewMode }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const current =
    modes().find((entry) => entry.value === viewMode) ??
    (choices().find((entry) => entry.value === choice) as { label: string });

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
        title={l10n.t('How to draw the structure')}
        onClick={() => setOpen(!open)}
      >
        <img src={viewIcon(viewMode, choice, layout)} style={styles.pillIcon} alt="" />
        <span style={styles.pillLead}>{l10n.t('Drawing:')}</span>
        <strong style={styles.pillValue}>{current.label}</strong>
        <ChevronIcon />
      </button>

      {open && (
        <div role="menu" style={styles.menu}>
          <div style={styles.menuTitle}>{l10n.t('Pointer graph')}</div>
          {choices().map((entry) => (
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
            <div style={styles.menuTitle}>{l10n.t('Other views')}</div>
            {modes().map((entry) => (
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
  layout: LayoutKind | null;
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
  layout,
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
      layout={layout}
      viewMode={viewMode}
      onGraphChoice={onGraphChoice}
      onViewMode={onViewMode}
    />

    {viewMode !== 'recursion' && (
      <>
        <span className="dbga-sep" />

        <div className="dbga-segment" role="group" aria-label={l10n.t('Frames in the graph')}>
          <button
            type="button"
            className="dbga-chip"
            aria-pressed={!manual && frameMode === 'current'}
            title={l10n.t('Show only what comes from the frame where execution stopped')}
            onClick={() => onFrameMode('current')}
          >
            <FrameIcon />
            {compact ? l10n.t('current') : l10n.t('Current frame')}
          </button>

          <button
            type="button"
            className="dbga-chip"
            aria-pressed={!manual && frameMode === 'all'}
            title={l10n.t('Show what comes from all frames')}
            onClick={() => onFrameMode('all')}
          >
            <StackIcon />
            {compact ? l10n.t('all') : l10n.t('All frames')}
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
          title={l10n.t('Draw null pointers as terminals in the graph')}
          onClick={() => onNullTerminals(!nullTerminals)}
        >
          <NullIcon />
          {compact ? 'NULL' : l10n.t('Show nulls')}
        </button>

        <button
          type="button"
          className="dbga-chip"
          aria-pressed={follow}
          title={l10n.t('Bring the canvas to the frame where execution stopped at each pause')}
          onClick={() => onFollow(!follow)}
        >
          <FollowIcon />
          {compact ? l10n.t('follow') : l10n.t('Follow execution')}
        </button>
      </>
    )}
  </div>
);
export default Toolbar;
