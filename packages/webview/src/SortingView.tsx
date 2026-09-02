import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Pass } from './graphModel';
import {
  type ArrayTrack,
  type Marker,
  defaultTracks,
  markersByIndex,
  sortingModel,
} from './sortingModel';
import { MAX_SCALE, MIN_SCALE, type Camera, type PanelState } from './persistence';
import type { ScreenState } from './state';
import {
  CAMERA_DURATION,
  type Viewport,
  cameraPlan,
  interpolate,
  settled,
  steppedScale,
  toTranslate,
} from './camera';
import { ZOOM_STEP, ZoomControl } from './Toolbar';

const FIT_FILL = 0.9;
const FIT_MIN_SHARE = 0.05;
const FIT_MIN_SCALE = 0.05;
const FIT_MAX_SCALE = 1;
const FOCUS_FILL = 0.9;
const FOCUS_MIN_SHARE = 0.25;
const FOCUS_MIN_SCALE = 0.3;
const FOCUS_MAX_SCALE = 1;

const CELL_HEIGHT = 24;
const INDEX_HEIGHT = 14;
const MARKER_HEIGHT = 18;

interface SortingViewProps {
  state: ScreenState;
  pass: Pass;
  panel: PanelState;
  updatePanel: (patch: Partial<PanelState>) => void;
  enabledFrames: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  children?: React.ReactNode;
}

const SortingView: React.FC<SortingViewProps> = ({
  state,
  pass,
  panel,
  updatePanel,
  enabledFrames,
  selectedId,
  onSelect,
  children,
}) => {
  const viewportBoxRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const glideRef = useRef<number | null>(null);
  const camerasRef = useRef(panel.cameras);
  const seatedRef = useRef(panel.cameras.sorting !== undefined);

  const [viewport, setViewport] = useState<Viewport>(() => asViewport(panel.cameras.sorting));
  const viewportRef = useRef<Viewport>(viewport);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    camerasRef.current = panel.cameras;
  }, [panel.cameras]);

  const remember = useCallback(
    (now: Viewport) => {
      updatePanel({ cameras: { ...camerasRef.current, sorting: now } });
    },
    [updatePanel],
  );

  const model = useMemo(
    () =>
      state.snapshot === null
        ? null
        : sortingModel(
            state.snapshot,
            pass.of === state.snapshot ? pass.previous : null,
            enabledFrames,
          ),
    [state.snapshot, pass, enabledFrames],
  );

  const enabled = useMemo(() => {
    if (model === null) {
      return new Set<string>();
    }

    const known = model.tracks.map((track) => track.key);
    const chosen = panel.tracks === null ? null : panel.tracks.filter((key) => known.includes(key));

    return new Set(chosen === null || chosen.length === 0 ? defaultTracks(model) : chosen);
  }, [model, panel.tracks]);

  const hidden = useMemo(() => new Set(panel.hiddenMarkers ?? []), [panel.hiddenMarkers]);

  const drawn = useMemo(
    () => (model === null ? [] : model.tracks.filter((track) => enabled.has(track.key))),
    [model, enabled],
  );

  const legend = useMemo(() => {
    const seen = new Map<string, Marker>();

    drawn.forEach((track) => track.markers.forEach((marker) => seen.set(marker.id, marker)));

    return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [drawn]);

  const focusKey = useMemo(() => {
    const changed = drawn.find((track) => track.changed.size > 0);

    return changed?.key ?? drawn[0]?.key ?? null;
  }, [drawn]);

  const halt = useCallback(() => {
    if (glideRef.current !== null) {
      window.cancelAnimationFrame(glideRef.current);
      glideRef.current = null;
    }
  }, []);

  const glide = useCallback(
    (to: Viewport) => {
      halt();

      const from = viewportRef.current;
      if (settled(from, to)) {
        return;
      }

      const started = performance.now();

      const step = () => {
        const progress = (performance.now() - started) / CAMERA_DURATION;
        const now = interpolate(from, to, progress);

        viewportRef.current = now;
        setViewport(now);

        if (progress >= 1) {
          glideRef.current = null;
          remember(now);
          return;
        }

        glideRef.current = window.requestAnimationFrame(step);
      };

      glideRef.current = window.requestAnimationFrame(step);
    },
    [halt, remember],
  );

  const fit = useCallback(() => {
    const stackEl = stackRef.current;
    const box = viewportBoxRef.current;
    if (stackEl === null || box === null) {
      return;
    }

    const extent = {
      left: 0,
      top: 0,
      right: Math.max(stackEl.scrollWidth, 1),
      bottom: Math.max(stackEl.scrollHeight, 1),
    };
    const boxSize = { width: box.clientWidth, height: box.clientHeight };
    const target = cameraPlan(extent, boxSize, viewportRef.current.scale, {
      fill: FIT_FILL,
      floor: FIT_MIN_SCALE,
      ceiling: FIT_MAX_SCALE,
      share: FIT_MIN_SHARE,
      lazy: false,
    });

    glide(toTranslate(target, boxSize));
  }, [glide]);

  const focusTrack = useCallback(
    (key: string) => {
      const element = trackRefs.current.get(key);
      const box = viewportBoxRef.current;
      if (element === undefined || box === null) {
        return;
      }

      const extent = {
        left: element.offsetLeft,
        right: element.offsetLeft + element.offsetWidth,
        top: element.offsetTop,
        bottom: element.offsetTop + element.offsetHeight,
      };
      const boxSize = { width: box.clientWidth, height: box.clientHeight };
      const target = cameraPlan(extent, boxSize, viewportRef.current.scale, {
        fill: FOCUS_FILL,
        floor: FOCUS_MIN_SCALE,
        ceiling: FOCUS_MAX_SCALE,
        share: FOCUS_MIN_SHARE,
        lazy: true,
      });

      glide(toTranslate(target, boxSize));
    },
    [glide],
  );

  const zoomAround = useCallback(
    (nextScale: number) => {
      const box = viewportBoxRef.current;
      if (box === null) {
        return;
      }

      const current = viewportRef.current;
      const boxSize = { width: box.clientWidth, height: box.clientHeight };
      const worldX = (boxSize.width / 2 - current.x) / current.scale;
      const worldY = (boxSize.height / 2 - current.y) / current.scale;

      glide(toTranslate({ x: worldX, y: worldY, scale: nextScale }, boxSize));
    },
    [glide],
  );

  const zoomBy = useCallback(
    (direction: number) =>
      zoomAround(
        steppedScale(viewportRef.current.scale, direction, ZOOM_STEP, MIN_SCALE, MAX_SCALE),
      ),
    [zoomAround],
  );

  const zoomTo = useCallback(
    (next: number) => zoomAround(Math.min(Math.max(next, MIN_SCALE), MAX_SCALE)),
    [zoomAround],
  );

  useEffect(() => {
    if (state.snapshot === null || seatedRef.current) {
      return;
    }

    seatedRef.current = true;
    fit();
  }, [state.snapshot, fit]);

  useEffect(() => {
    const box = viewportBoxRef.current;
    if (box === null) {
      return;
    }

    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    };

    const down = (event: PointerEvent): void => {
      halt();

      const from = { x: event.clientX, y: event.clientY };
      const start = viewportRef.current;

      const move = (at: PointerEvent): void => {
        const next = {
          ...start,
          x: start.x + (at.clientX - from.x),
          y: start.y + (at.clientY - from.y),
        };
        viewportRef.current = next;
        setViewport(next);
      };

      const done = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', done);
        window.removeEventListener('pointercancel', done);
        remember(viewportRef.current);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', done);
      window.addEventListener('pointercancel', done);
    };

    box.addEventListener('wheel', wheel, { passive: false });
    box.addEventListener('pointerdown', down);

    return () => {
      box.removeEventListener('wheel', wheel);
      box.removeEventListener('pointerdown', down);
    };
  }, [halt, zoomBy, remember]);

  const registerTrack = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el === null) {
      trackRefs.current.delete(key);
    } else {
      trackRefs.current.set(key, el);
    }
  }, []);

  const toggleTrack = (key: string): void => {
    const known = (model?.tracks ?? []).map((track) => track.key);
    const current = known.filter((entry) => enabled.has(entry));

    updatePanel({
      tracks: current.includes(key)
        ? current.filter((entry) => entry !== key)
        : known.filter((entry) => entry === key || current.includes(entry)),
    });
  };

  const toggleMarker = (id: string): void => {
    const current = [...hidden];

    updatePanel({
      hiddenMarkers: current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    });
  };

  return (
    <div ref={viewportBoxRef} style={styles.viewport}>
      <div
        ref={stackRef}
        style={{
          ...styles.stack,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {drawn.map((track) => (
          <TrackView
            key={track.key}
            track={track}
            hidden={hidden}
            selectedId={selectedId}
            onSelect={onSelect}
            trackRef={(el) => registerTrack(track.key, el)}
          />
        ))}
        {drawn.length === 0 && (
          <div style={styles.empty}>
            Nenhum vetor está sendo mostrado. Ligue um na lista do canto superior esquerdo.
          </div>
        )}
      </div>

      {model !== null && model.tracks.length > 0 && (
        <div style={styles.picker}>
          <div style={styles.pickerRow}>
            <span style={styles.pickerLabel}>vetores</span>
            {model.tracks.map((track) => (
              <button
                key={track.key}
                type="button"
                className="dbga-chip"
                aria-pressed={enabled.has(track.key)}
                title={`${track.type} com ${track.length} posições`}
                onClick={() => toggleTrack(track.key)}
              >
                {track.names.length === 0 ? track.type : track.names.join(', ')}
              </button>
            ))}
          </div>
          {legend.length > 0 && (
            <div style={styles.pickerRow}>
              <span style={styles.pickerLabel}>marcadores</span>
              {legend.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  className="dbga-chip"
                  aria-pressed={!hidden.has(marker.id)}
                  title={`${marker.function} #${marker.frameLevel}`}
                  onClick={() => toggleMarker(marker.id)}
                >
                  {marker.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ZoomControl
        scale={viewport.scale}
        onStep={zoomBy}
        onReset={() => zoomTo(1)}
        onFit={fit}
        onFocus={() => focusKey !== null && focusTrack(focusKey)}
        canFocus={focusKey !== null}
      />
      {children}
    </div>
  );
};

function asViewport(camera: Camera | null | undefined): Viewport {
  return camera === null || camera === undefined
    ? { x: 0, y: 0, scale: 1 }
    : { x: camera.x, y: camera.y, scale: camera.scale };
}

const TrackView: React.FC<{
  track: ArrayTrack;
  hidden: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  trackRef: (el: HTMLDivElement | null) => void;
}> = ({ track, hidden, selectedId, onSelect, trackRef }) => {
  const stacks = [...markersByIndex(track).values()]
    .map((list) => list.filter((marker) => !hidden.has(marker.id)))
    .filter((list) => list.length > 0);
  const depth = stacks.reduce((most, list) => Math.max(most, list.length), 0);
  const width = track.cells.length * track.step;
  const height = CELL_HEIGHT + INDEX_HEIGHT + depth * MARKER_HEIGHT;

  return (
    <div ref={trackRef} style={styles.track}>
      <button
        type="button"
        className="dbga-row"
        aria-pressed={track.canvasId === selectedId}
        style={styles.trackHeader}
        onClick={() => onSelect(track.canvasId, true)}
      >
        <span style={styles.trackNames}>
          {track.names.length === 0 ? track.type : track.names.join(', ')}
        </span>
        <span style={styles.trackType}>{track.type}</span>
        {track.truncated && (
          <span style={styles.trackTruncated}>
            {track.cells.length} de {track.length}
          </span>
        )}
      </button>

      <div style={{ ...styles.ribbon, width, height }}>
        {track.cells.map((cell) => (
          <span
            key={`i${cell.index}`}
            style={{
              ...styles.cellIndex,
              width: track.cellWidth,
              transform: `translateX(${cell.index * track.step}px)`,
            }}
          >
            {cell.index}
          </span>
        ))}

        {track.cells.map((cell) => (
          <div
            key={cell.slot}
            style={{
              ...(cell.changed ? { ...styles.cell, ...styles.cellChanged } : styles.cell),
              width: track.cellWidth,
              transform: `translateX(${cell.index * track.step}px)`,
            }}
          >
            {cell.text}
          </div>
        ))}

        {stacks.flatMap((list) =>
          list.map((marker, position) => (
            <button
              key={marker.id}
              type="button"
              className="dbga-chip"
              aria-pressed={marker.id === selectedId}
              style={{
                ...styles.marker,
                width: track.cellWidth,
                top: CELL_HEIGHT + INDEX_HEIGHT + position * MARKER_HEIGHT,
                transform: `translateX(${marker.index * track.step}px)`,
              }}
              title={`${marker.function} #${marker.frameLevel}`}
              onClick={() => onSelect(marker.id, true)}
            >
              {marker.name}
            </button>
          )),
        )}

        {track.truncated && (
          <span
            style={{
              ...styles.cut,
              transform: `translateX(${track.cells.length * track.step}px)`,
            }}
          >
            …
          </span>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
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
    fontSize: '12px',
  },
  empty: { opacity: 0.6, padding: '12px' },
  track: {
    padding: '8px 10px',
    borderRadius: '4px',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #454545)',
  },
  trackHeader: { display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '6px' },
  trackNames: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)', fontWeight: 600 },
  trackType: { opacity: 0.55 },
  trackTruncated: { color: 'var(--vscode-charts-orange, #d7ba7d)' },
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
    border: '1px solid var(--vscode-editorWidget-border, #454545)',
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
    fontSize: '9px',
    opacity: 0.45,
  },
  marker: {
    position: 'absolute',
    left: 0,
    height: MARKER_HEIGHT - 2,
    boxSizing: 'border-box',
    fontSize: '10px',
    padding: '0 2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'transform 320ms ease-in-out, top 320ms ease-in-out',
  },
  cut: { position: 'absolute', top: INDEX_HEIGHT, left: 0, padding: '4px 6px', opacity: 0.55 },
  picker: {
    position: 'absolute',
    zIndex: 2,
    top: '8px',
    left: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '4px',
    maxWidth: '45%',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #333)',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    fontFamily: 'var(--vscode-font-family, sans-serif)',
    fontSize: '12px',
  },
  pickerRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' },
  pickerLabel: { opacity: 0.6, minWidth: '68px' },
};

export default SortingView;
