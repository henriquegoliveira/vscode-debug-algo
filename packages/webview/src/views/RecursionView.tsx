import {
  type Viewport,
  CAMERA_DURATION,
  FIT_FILL,
  FIT_MAX_SCALE,
  FIT_MIN_SCALE,
  FIT_MIN_SHARE,
  FOCUS_FILL,
  FOCUS_MAX_SCALE,
  FOCUS_MIN_SCALE,
  FOCUS_MIN_SHARE,
  cameraPlan,
  interpolate,
  settled,
  steppedScale,
  toTranslate,
} from '../geometry/camera';
import { callStackModel } from '../model/callStack';
import type { Pass } from '../model/graph/types';
import { MAX_SCALE, MIN_SCALE } from '../session/persistence';
import type { ScreenState } from '../session/state';
import { overContent } from './gestures';
import { GridLayer } from '../ui/GridLayer';
import { ZOOM_STEP, ZoomControl } from '../ui/Toolbar';
import { Connector } from '../ui/recursion/Connector';
import { FrameCardView } from '../ui/recursion/FrameCardView';
import { GlobalsCardView } from '../ui/recursion/GlobalsCardView';
import { styles } from '../ui/recursion/RecursionView.styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
      if (!overContent(event.target, box, stackRef.current)) {
        return;
      }

      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    };

    const down = (event: PointerEvent): void => {
      if (!overContent(event.target, box, stackRef.current)) {
        return;
      }

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
      <GridLayer viewport={viewport} />
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

export default RecursionView;
