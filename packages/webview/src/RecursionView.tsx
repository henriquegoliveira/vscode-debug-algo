import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type FrameCard, callStackModel } from './callStackModel';
import type { FrameRoot, Pass } from './graphModel';
import { MAX_SCALE, MIN_SCALE } from './persistence';
import type { ScreenState } from './state';
import {
  CAMERA_DURATION,
  type Viewport,
  cameraPlan,
  interpolate,
  settled,
  steppedScale,
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

interface Box {
  width: number;
  height: number;
}

interface RecursionViewProps {
  state: ScreenState;
  pass: Pass;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  children?: React.ReactNode;
}

const RecursionView: React.FC<RecursionViewProps> = ({
  state,
  pass,
  selectedId,
  onSelect,
  children,
}) => {
  const viewportBoxRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const glideRef = useRef<number | null>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const stack = useMemo(
    () =>
      state.snapshot === null
        ? null
        : callStackModel(state.snapshot, pass.of === state.snapshot ? pass.previous : null),
    [state.snapshot, pass],
  );

  const focusLevel = useMemo(() => {
    if (stack === null || stack.frames.length === 0) {
      return null;
    }

    const changed = stack.frames.find((frame) => frame.changedRoots.size > 0);

    return changed === undefined ? 0 : changed.level;
  }, [stack]);

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
          return;
        }

        glideRef.current = window.requestAnimationFrame(step);
      };

      glideRef.current = window.requestAnimationFrame(step);
    },
    [halt],
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

  const focusCard = useCallback(
    (level: number) => {
      const card = cardRefs.current.get(level);
      const box = viewportBoxRef.current;
      if (card === undefined || box === null) {
        return;
      }

      const extent = {
        left: card.offsetLeft,
        right: card.offsetLeft + card.offsetWidth,
        top: card.offsetTop,
        bottom: card.offsetTop + card.offsetHeight,
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
    if (state.snapshot === null) {
      return;
    }

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
  }, [halt, zoomBy]);

  const registerCard = useCallback((level: number, el: HTMLDivElement | null) => {
    if (el === null) {
      cardRefs.current.delete(level);
    } else {
      cardRefs.current.set(level, el);
    }
  }, []);

  const frames = stack?.frames ?? [];
  const globals = stack?.globals ?? [];

  return (
    <div ref={viewportBoxRef} style={styles.viewport}>
      <div
        ref={stackRef}
        style={{
          ...styles.stack,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {frames.map((frame, index) => (
          <React.Fragment key={frame.level}>
            <FrameCardView
              frame={frame}
              selectedId={selectedId}
              onSelect={onSelect}
              cardRef={(el) => registerCard(frame.level, el)}
            />
            {index < frames.length - 1 && <Connector label="foi chamado por" />}
          </React.Fragment>
        ))}
        {globals.length > 0 && (
          <>
            {frames.length > 0 && <Connector label="globais do arquivo" />}
            <GlobalsCardView roots={globals} selectedId={selectedId} onSelect={onSelect} />
          </>
        )}
      </div>
      <ZoomControl
        scale={viewport.scale}
        onStep={zoomBy}
        onReset={() => zoomTo(1)}
        onFit={fit}
        onFocus={() => focusLevel !== null && focusCard(focusLevel)}
        canFocus={focusLevel !== null}
      />
      {children}
    </div>
  );
};

const FrameCardView: React.FC<{
  frame: FrameCard;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  cardRef: (el: HTMLDivElement | null) => void;
}> = ({ frame, selectedId, onSelect, cardRef }) => (
  <div
    ref={cardRef}
    style={frame.isCurrent ? { ...styles.card, ...styles.cardCurrent } : styles.card}
  >
    <div style={styles.cardHeader}>
      {frame.function} #{frame.level}
    </div>
    {frame.roots.map((root) => (
      <RootLine
        key={root.id}
        root={root}
        changed={frame.changedRoots.has(root.id)}
        active={root.id === selectedId}
        onSelect={onSelect}
      />
    ))}
    {frame.roots.length === 0 && <div style={styles.cardEmpty}>sem variáveis</div>}
  </div>
);

const GlobalsCardView: React.FC<{
  roots: FrameRoot[];
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ roots, selectedId, onSelect }) => (
  <div style={styles.card}>
    <div style={styles.cardHeader}>Globais do arquivo</div>
    {roots.map((root) => (
      <RootLine
        key={root.id}
        root={root}
        changed={false}
        active={root.id === selectedId}
        onSelect={onSelect}
      />
    ))}
  </div>
);

const RootLine: React.FC<{
  root: FrameRoot;
  changed: boolean;
  active: boolean;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ root, changed, active, onSelect }) => (
  <button
    type="button"
    className="dbga-row"
    aria-pressed={active}
    style={
      root.origin === 'parameter' ? { ...styles.rootLine, ...styles.parameter } : styles.rootLine
    }
    onClick={() => onSelect(root.id, true)}
  >
    <span style={styles.rootName}>{root.name}</span>
    <span style={changed ? { ...styles.rootValue, ...styles.rootChanged } : styles.rootValue}>
      {rootCell(root)}
    </span>
  </button>
);

const Connector: React.FC<{ label: string }> = ({ label }) => (
  <div style={styles.connector}>
    <span style={styles.connectorLine} />
    <span style={styles.connectorLabel}>{label}</span>
    <span style={styles.connectorLine} />
  </div>
);

function rootCell(root: FrameRoot): string {
  if (root.status !== 'ok') {
    return root.status;
  }

  if (root.value !== '') {
    return root.value;
  }

  return root.category === 'pointer' || root.category === 'reference' ? '→' : '';
}

function toTranslate(target: Viewport, box: Box): Viewport {
  return {
    x: box.width / 2 - target.x * target.scale,
    y: box.height / 2 - target.y * target.scale,
    scale: target.scale,
  };
}

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
    alignItems: 'center',
    width: 'max-content',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '12px',
  },
  card: {
    minWidth: '220px',
    padding: '8px 10px',
    borderRadius: '4px',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #454545)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
  },
  cardCurrent: { borderColor: 'var(--vscode-focusBorder, #007fd4)', borderWidth: '2px' },
  cardHeader: {
    fontWeight: 600,
    marginBottom: '6px',
    color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
  },
  cardEmpty: { opacity: 0.55, padding: '2px 0' },
  rootLine: {
    display: 'flex',
    width: '100%',
    gap: '8px',
    alignItems: 'baseline',
    background: 'none',
    border: 'none',
    padding: '1px 0',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
    color: 'inherit',
  },
  parameter: { fontStyle: 'italic' },
  rootName: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  rootValue: {
    marginLeft: 'auto',
    color: 'var(--vscode-charts-green, #b5cea8)',
    wordBreak: 'break-all',
  },
  rootChanged: {
    color: 'var(--vscode-editor-foreground, #d4d4d4)',
    fontWeight: 700,
  },
  connector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '4px 0',
    opacity: 0.6,
    fontSize: '10px',
  },
  connectorLine: {
    width: '1px',
    height: '10px',
    backgroundColor: 'var(--vscode-charts-lines, #9a9a9a)',
  },
  connectorLabel: { whiteSpace: 'nowrap' },
};

export default RecursionView;
