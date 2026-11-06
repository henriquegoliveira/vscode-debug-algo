import * as l10n from '@vscode/l10n';
import type { Box } from '../geometry/boxes';
import {
  CAMERA_DURATION,
  type Extent,
  FIT_FILL,
  FIT_MAX_SCALE,
  FIT_MIN_SCALE,
  FIT_MIN_SHARE,
  FOCUS_FILL,
  FOCUS_MAX_SCALE,
  FOCUS_MIN_SCALE,
  FOCUS_MIN_SHARE,
  FOLLOW_FILL,
  FOLLOW_MAX_SCALE,
  FOLLOW_MIN_SCALE,
  type Frame,
  Viewport,
  cameraPlan,
  followPlan,
  interpolate,
  settled,
  steppedScale,
} from '../geometry/camera';
import { ORIGIN, type Seat, anchorShift, planMotion, shiftSeats } from '../geometry/motion';
import { changeHighlight, changedEdges, focusTarget } from '../model/graph/changes';
import { rootFollowers, toGraph } from '../model/graph/toGraph';
import { CanvasNode, GraphModel, Pass } from '../model/graph/types';
import { visibleSnapshot } from '../model/graph/visibility';
import { LayoutKind, layoutForChoice, promotes } from '../model/layoutRule';
import { treeOrder } from '../model/orientation';
import {
  FileView,
  MAX_COLUMN_WIDTH,
  MAX_SCALE,
  MIN_COLUMN_WIDTH,
  MIN_SCALE,
  PanelState,
  writePanelState,
} from '../session/persistence';
import type { ScreenState } from '../session/state';
import { ColumnButton, ZOOM_STEP, ZoomControl } from '../ui/Toolbar';
import { ListIcon } from '../ui/icons';
import { RootRow } from '../ui/graph/RootRow';
import { Theme } from '../ui/theme';
import { styles } from '../ui/graph/GraphView.styles';
import { remove } from './dataSet';
import { paintGrid } from './gridPainter';
import { type MotionHandle, createMotion } from './motion';
import { layoutOptions, networkOptions } from './networkOptions';
import { nodePainter } from './nodePainter';
import { remeasureNodes } from './remeasure';
import { type Trail, parentOf, seatMap, seatPayload } from './seats';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataSet } from 'vis-data';
import { Edge, Network, Node } from 'vis-network';

const EMPTY_MODEL: GraphModel = {
  canvas: { nodes: [], edges: [] },
  frames: [],
  globals: [],
  cards: [],
};

const EMPTY_BOX: Box = { width: 0, height: 0 };

const GESTURE_SLOP = 4;

interface GraphViewProps {
  state: ScreenState;
  theme: Theme;
  fileView: FileView;
  updateFile: (patch: Partial<FileView>) => void;
  panel: PanelState;
  panelRef: React.MutableRefObject<PanelState>;
  updatePanel: (patch: Partial<PanelState>) => void;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  narrow: boolean;
  bodyWidth: number | null;
  pass: Pass;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  onSelectInvalid: () => void;
  revealRequestRef: React.MutableRefObject<string | null>;
  enabledFrames: Set<string>;
  toggleFrame: (id: string) => void;
  layout: LayoutKind | null;
  setLayout: (kind: LayoutKind) => void;
  children?: React.ReactNode;
}

const GraphView: React.FC<GraphViewProps> = ({
  state,
  theme,
  fileView,
  updateFile,
  panel,
  panelRef,
  updatePanel,
  bodyRef,
  narrow,
  bodyWidth,
  pass,
  selectedId,
  onSelect,
  onSelectInvalid,
  revealRequestRef,
  enabledFrames,
  toggleFrame,
  layout,
  setLayout,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLElement>(null);
  const nodesRef = useRef<DataSet<Node> | null>(null);
  const edgesRef = useRef<DataSet<Edge> | null>(null);
  const networkRef = useRef<Network | null>(null);
  const layoutAppliedRef = useRef<{ scope: string; kind: LayoutKind } | null>(null);
  const scrollRestoredRef = useRef(false);
  const followersRef = useRef<Map<string, string[]>>(new Map());
  const cardOfRef = useRef<Map<string, string>>(new Map());
  const boxesRef = useRef<Map<string, Box>>(new Map());
  const specsRef = useRef<Map<string, CanvasNode>>(new Map());
  const themeRef = useRef<Theme>(theme);
  const measureRef = useRef<number | null>(null);
  const layoutRenderedRef = useRef<LayoutKind | null>(null);
  const trailRef = useRef<Trail | null>(null);
  const seatsRef = useRef<Map<string, Seat>>(new Map());
  const motionRef = useRef<MotionHandle | null>(null);
  const motionPassRef = useRef<Pass | null>(null);
  const glideRef = useRef<number | null>(null);
  const saveRef = useRef<number | null>(null);
  const rememberRef = useRef<() => void>(() => undefined);
  const restoredRef = useRef(false);
  const followRef = useRef(false);
  const releaseRef = useRef<() => void>(() => undefined);
  const revealRef = useRef<(id: string) => void>(() => undefined);

  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [scale, setScale] = useState(1);

  const follow = fileView.follow;

  const columnWidth =
    narrow && bodyWidth !== null
      ? Math.min(dragWidth ?? panel.columnWidth, Math.max(bodyWidth - 56, MIN_COLUMN_WIDTH))
      : (dragWidth ?? panel.columnWidth);

  const highlight = useMemo(() => changeHighlight(pass, state.snapshot), [pass, state.snapshot]);

  const highlightEdges = useMemo(
    () => (pass.of !== state.snapshot ? new Set<string>() : new Set(pass.changes.edges)),
    [pass, state.snapshot],
  );

  const order = useMemo(
    () =>
      state.snapshot === null
        ? undefined
        : treeOrder(state.snapshot, state.orientation, fileView.mirrored),
    [state.snapshot, state.orientation, fileView.mirrored],
  );

  const model = useMemo(
    () =>
      state.snapshot === null
        ? EMPTY_MODEL
        : toGraph(state.snapshot, theme, {
            nullTerminals: fileView.nullTerminals,
            pinned: layout === 'hierarchical',
            frames: enabledFrames,
            fields: fileView.fields,
            highlight,
            highlightEdges,
            order,
          }),
    [
      state.snapshot,
      order,
      theme,
      fileView.nullTerminals,
      fileView.fields,
      layout,
      enabledFrames,
      highlight,
      highlightEdges,
    ],
  );

  const counts = useMemo(
    () =>
      model.frames.reduce(
        (total, frame) => ({
          shown: total.shown + (frame.enabled ? frame.roots.length : 0),
          total: total.total + frame.roots.length,
        }),
        { shown: 0, total: 0 },
      ),
    [model],
  );

  const halt = useCallback(() => {
    if (glideRef.current !== null) {
      window.cancelAnimationFrame(glideRef.current);
      glideRef.current = null;
    }
  }, []);

  const glide = useCallback(
    (to: Viewport) => {
      const network = networkRef.current;
      if (network === null) {
        return;
      }

      halt();

      const at = network.getViewPosition();
      const from: Viewport = { x: at.x, y: at.y, scale: network.getScale() };

      if (settled(from, to)) {
        return;
      }

      const started = performance.now();

      const step = () => {
        const progress = (performance.now() - started) / CAMERA_DURATION;
        const now = interpolate(from, to, progress);

        network.moveTo({ position: { x: now.x, y: now.y }, scale: now.scale, animation: false });
        setScale(now.scale);

        if (progress >= 1) {
          glideRef.current = null;
          rememberRef.current();
          return;
        }

        glideRef.current = window.requestAnimationFrame(step);
      };

      glideRef.current = window.requestAnimationFrame(step);
    },
    [halt],
  );

  const extentOf = useCallback((ids: string[]): Extent | null => {
    const network = networkRef.current;

    if (network === null || ids.length === 0) {
      return null;
    }

    const placed = network.getPositions(ids);
    const boxes = boxesRef.current;
    const seats = ids
      .map((id) => {
        const at = seatsRef.current.get(id) ?? placed[id];

        return at === undefined ? null : { at, box: boxes.get(id) ?? EMPTY_BOX };
      })
      .filter((seat): seat is { at: Seat; box: Box } => seat !== null);

    if (seats.length === 0) {
      return null;
    }

    return {
      left: Math.min(...seats.map((seat) => seat.at.x - seat.box.width / 2)),
      right: Math.max(...seats.map((seat) => seat.at.x + seat.box.width / 2)),
      top: Math.min(...seats.map((seat) => seat.at.y - seat.box.height / 2)),
      bottom: Math.max(...seats.map((seat) => seat.at.y + seat.box.height / 2)),
    };
  }, []);

  const viewport = useCallback((): { frame: Frame; at: Viewport } | null => {
    const network = networkRef.current;
    const box = containerRef.current;

    if (network === null || box === null) {
      return null;
    }

    const at = network.getViewPosition();

    return {
      frame: { width: box.clientWidth, height: box.clientHeight },
      at: { x: at.x, y: at.y, scale: network.getScale() },
    };
  }, []);

  const focusNodes = useCallback(
    (ids: string[]) => {
      const seen = viewport();
      const extent = extentOf(ids);

      if (seen === null || extent === null) {
        return;
      }

      glide(
        cameraPlan(extent, seen.frame, seen.at.scale, {
          fill: FOCUS_FILL,
          floor: FOCUS_MIN_SCALE,
          ceiling: FOCUS_MAX_SCALE,
          share: FOCUS_MIN_SHARE,
          lazy: true,
        }),
      );
    },
    [glide, extentOf, viewport],
  );

  const drawnIds = useCallback((): string[] => (nodesRef.current?.getIds() ?? []) as string[], []);

  const followGraph = useCallback(
    (ids: string[]) => {
      const seen = viewport();
      const graph = extentOf(drawnIds());

      if (seen === null || graph === null) {
        return;
      }

      glide(
        followPlan(graph, extentOf(ids), seen.frame, {
          fill: FOLLOW_FILL,
          floor: FOLLOW_MIN_SCALE,
          ceiling: FOLLOW_MAX_SCALE,
        }),
      );
    },
    [glide, extentOf, viewport, drawnIds],
  );

  const fitAll = useCallback(() => {
    const seen = viewport();
    const extent = extentOf(drawnIds());

    if (seen === null || extent === null) {
      return;
    }

    glide(
      cameraPlan(extent, seen.frame, seen.at.scale, {
        fill: FIT_FILL,
        floor: FIT_MIN_SCALE,
        ceiling: FIT_MAX_SCALE,
        share: FIT_MIN_SHARE,
        lazy: false,
      }),
    );
  }, [glide, extentOf, viewport, drawnIds]);

  const zoomBy = useCallback(
    (direction: number) => {
      const network = networkRef.current;
      if (network === null) {
        return;
      }

      const at = network.getViewPosition();
      glide({
        x: at.x,
        y: at.y,
        scale: steppedScale(network.getScale(), direction, ZOOM_STEP, MIN_SCALE, MAX_SCALE),
      });
    },
    [glide],
  );

  const zoomTo = useCallback(
    (next: number) => {
      const network = networkRef.current;
      if (network === null) {
        return;
      }

      const at = network.getViewPosition();
      glide({ x: at.x, y: at.y, scale: Math.min(Math.max(next, MIN_SCALE), MAX_SCALE) });
    },
    [glide],
  );

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    const nodes = new DataSet<Node>([]);
    const edges = new DataSet<Edge>([]);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const painter = nodePainter({
      node: (id) => specsRef.current.get(id),
      theme: () => themeRef.current,
      alpha: (id) => motionRef.current?.alphaOf(id) ?? 1,
    });

    const network = new Network(containerRef.current, { nodes, edges }, networkOptions(painter));
    network.setOptions(layoutOptions('default'));
    networkRef.current = network;
    motionRef.current = createMotion(network, edges);

    network.on('beforeDrawing', (context: CanvasRenderingContext2D) =>
      paintGrid(context, themeRef.current, network.getScale()),
    );

    const beginTrail = (ids: string[]): void => {
      const placed = network.getPositions();
      const anchors = new Map<string, Seat>();
      const followers = new Map<string, Seat>();

      ids.forEach((id) => {
        const at = placed[id];
        const attached = followersRef.current.get(id) ?? [];

        if (at === undefined || attached.length === 0) {
          return;
        }

        anchors.set(id, { x: at.x, y: at.y });
        attached.forEach((balloon) => {
          const seat = placed[balloon];
          if (seat !== undefined) {
            followers.set(balloon, { x: seat.x, y: seat.y });
          }
        });
      });

      trailRef.current = anchors.size === 0 ? null : { anchors, followers };
    };

    const trail = (): void => {
      const moving = trailRef.current;
      if (moving === null) {
        return;
      }

      const placed = network.getPositions();

      moving.anchors.forEach((start, id) => {
        const at = placed[id];
        if (at === undefined) {
          return;
        }

        (followersRef.current.get(id) ?? []).forEach((balloon) => {
          const from = moving.followers.get(balloon);
          if (from !== undefined) {
            network.moveNode(balloon, from.x + at.x - start.x, from.y + at.y - start.y);
          }
        });
      });
    };

    const remember = (): void => {
      if (saveRef.current !== null) {
        return;
      }

      saveRef.current = window.requestAnimationFrame(() => {
        saveRef.current = null;
        const at = network.getViewPosition();
        writePanelState({
          ...panelRef.current,
          camera: { scale: network.getScale(), x: at.x, y: at.y },
        });
      });
    };

    rememberRef.current = remember;

    network.on('dragStart', (params: { nodes: string[] }) => beginTrail(params.nodes));
    network.on('dragging', trail);
    network.on('dragEnd', () => {
      trail();
      trailRef.current = null;
      remember();
    });

    network.on('zoom', () => {
      setScale(network.getScale());
      remember();
    });

    network.on('click', (params: { nodes: string[]; edges: string[] }) => {
      if (params.nodes.length > 0) {
        onSelect(params.nodes[0]);
        return;
      }

      if (params.edges.length === 0) {
        onSelect(null);
      }
    });

    return () => {
      if (measureRef.current !== null) {
        window.cancelAnimationFrame(measureRef.current);
        measureRef.current = null;
      }

      motionRef.current?.stop();
      motionRef.current = null;

      network.destroy();
      networkRef.current = null;
      nodesRef.current = null;
      edgesRef.current = null;
    };
  }, [onSelect, panelRef]);

  useEffect(() => {
    themeRef.current = theme;
    followRef.current = follow;
    releaseRef.current = () => updateFile({ follow: false });
  });

  useEffect(() => {
    revealRef.current = (id: string) => {
      const network = networkRef.current;
      if (network === null) {
        return;
      }

      const at = seatsRef.current.get(id) ?? network.getPositions([id])[id];
      if (at === undefined) {
        return;
      }

      glide({ x: at.x, y: at.y, scale: network.getScale() });
    };
  }, [glide]);

  useEffect(() => {
    const box = containerRef.current;
    if (box === null) {
      return;
    }

    const release = (): void => {
      if (followRef.current) {
        followRef.current = false;
        releaseRef.current();
      }
    };

    const wheel = (): void => {
      halt();
      release();
    };

    const down = (event: PointerEvent): void => {
      halt();

      const from = { x: event.clientX, y: event.clientY };

      const move = (at: PointerEvent): void => {
        if (Math.hypot(at.clientX - from.x, at.clientY - from.y) < GESTURE_SLOP) {
          return;
        }

        release();
        done();
      };

      const done = (): void => {
        window.removeEventListener('pointermove', move, { capture: true });
        window.removeEventListener('pointerup', done, { capture: true });
        window.removeEventListener('pointercancel', done, { capture: true });
      };

      window.addEventListener('pointermove', move, { capture: true });
      window.addEventListener('pointerup', done, { capture: true });
      window.addEventListener('pointercancel', done, { capture: true });
    };

    box.addEventListener('pointerdown', down, { capture: true });
    box.addEventListener('wheel', wheel, { capture: true, passive: true });

    return () => {
      box.removeEventListener('pointerdown', down, { capture: true });
      box.removeEventListener('wheel', wheel, { capture: true });
    };
  }, [halt]);

  useEffect(() => {
    const network = networkRef.current;
    const snapshot = state.snapshot;

    if (network === null || snapshot === null || snapshot.nodes.length === 0) {
      return;
    }

    const choice = fileView.layoutChoice;
    const applied = choice === 'auto' ? `auto:${state.sessionId ?? ''}` : `manual:${choice}`;
    const scope = `${state.file ?? ''}|${applied}`;
    const kind = layoutForChoice(
      choice,
      visibleSnapshot(snapshot, enabledFrames),
      state.orientation,
    );
    const last = layoutAppliedRef.current;

    if (last !== null && last.scope === scope) {
      if (choice !== 'auto' || !promotes(last.kind, kind)) {
        return;
      }
    }

    layoutAppliedRef.current = { scope, kind };
    setLayout(kind);
    network.setOptions(layoutOptions(kind));
  }, [
    state.snapshot,
    state.sessionId,
    state.orientation,
    state.file,
    fileView.layoutChoice,
    enabledFrames,
    setLayout,
  ]);

  useEffect(() => {
    networkRef.current?.redraw();
  }, [columnWidth, panel.columnOpen]);

  useEffect(() => {
    const column = columnRef.current;

    if (column === null || scrollRestoredRef.current || model.frames.length === 0) {
      return;
    }

    column.scrollTop = panelRef.current.columnScroll;
    scrollRestoredRef.current = true;
  }, [model, panel.columnOpen, panelRef]);

  useEffect(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes === null || edges === null) {
      return;
    }

    followersRef.current = rootFollowers(model);
    cardOfRef.current = new Map(
      model.cards.flatMap((card) => card.roots.map((root) => [root, card.id] as const)),
    );
    specsRef.current = new Map(model.canvas.nodes.map((node) => [node.id, node] as const));
    boxesRef.current = new Map(
      model.canvas.nodes.map((node) => [node.id, node.metrics.box] as const),
    );

    if (layout === null && model.canvas.nodes.length > 0) {
      return;
    }

    const placed = (networkRef.current?.getPositions() ?? {}) as Record<string, Seat>;
    const relayout = layoutRenderedRef.current !== layout;
    layoutRenderedRef.current = layout;
    const authoritative = layout === 'hierarchical';

    const targets = seatMap(model.canvas.nodes);
    const anchored = shiftSeats(
      targets,
      authoritative && !relayout ? anchorShift(targets, seatsRef.current) : ORIGIN,
    );
    seatsRef.current = authoritative ? anchored : new Map();

    const payload = seatPayload(model.canvas.nodes, anchored, placed, authoritative);

    remove(edges, model.canvas.edges);
    remove(nodes, model.canvas.nodes);
    nodes.update(payload as Node[]);
    edges.update(model.canvas.edges as Edge[]);

    const network = networkRef.current;
    if (network === null) {
      return;
    }

    const replay = motionPassRef.current !== pass;
    motionPassRef.current = pass;

    if (authoritative) {
      const parents = parentOf(model.canvas.edges);

      motionRef.current?.run(
        relayout || pass.first
          ? []
          : planMotion(anchored, new Map(Object.entries(placed)), (id) => parents.get(id)),
        replay && !pass.first ? changedEdges(pass.changes, model.canvas.edges) : [],
      );
    }

    if (measureRef.current !== null) {
      window.cancelAnimationFrame(measureRef.current);
    }

    measureRef.current = window.requestAnimationFrame(() => {
      measureRef.current = null;
      remeasureNodes(network);
    });

    if (selectedId === null) {
      network.unselectAll();
      return;
    }

    const drawn = cardOfRef.current.get(selectedId) ?? selectedId;

    if (nodes.get(drawn) === null) {
      onSelectInvalid();
      return;
    }

    network.selectNodes([drawn]);

    if (revealRequestRef.current === selectedId) {
      revealRef.current(drawn);
    }
  }, [model, layout, pass, selectedId, onSelectInvalid, revealRequestRef]);

  const aim = useMemo(() => {
    const snapshot = state.snapshot;

    if (snapshot === null || pass.of !== snapshot || pass.first) {
      return [];
    }

    const drawn = new Set(model.canvas.nodes.map((node) => node.id));

    return focusTarget(snapshot, pass.changes, drawn);
  }, [state.snapshot, pass, model]);

  const aimRef = useRef<string[]>(aim);

  useEffect(() => {
    aimRef.current = aim;
  });

  useEffect(() => {
    const network = networkRef.current;
    const snapshot = state.snapshot;

    if (
      network === null ||
      snapshot === null ||
      pass.of !== snapshot ||
      model.canvas.nodes.length === 0
    ) {
      return;
    }

    if (follow) {
      restoredRef.current = true;
      followGraph(aim);
      return;
    }

    if (pass.first) {
      const saved = restoredRef.current ? null : panelRef.current.camera;
      restoredRef.current = true;

      if (saved === null) {
        fitAll();
        return;
      }

      network.moveTo({ position: { x: saved.x, y: saved.y }, scale: saved.scale });
      setScale(saved.scale);
    }
  }, [model, layout, follow, aim, followGraph, fitAll, pass, state.snapshot, panelRef]);

  const startDrag = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      const body = bodyRef.current;
      if (body === null) {
        return;
      }

      const left = body.getBoundingClientRect().left;
      const clamp = (x: number) => Math.min(Math.max(x - left, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);

      const onMove = (move: MouseEvent) => setDragWidth(clamp(move.clientX));
      const onUp = (up: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setDragWidth(null);
        updatePanel({ columnWidth: clamp(up.clientX) });
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [updatePanel, bodyRef],
  );

  const onColumnScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      writePanelState({ ...panelRef.current, columnScroll: event.currentTarget.scrollTop });
    },
    [panelRef],
  );

  return (
    <>
      {panel.columnOpen && (
        <>
          <aside
            ref={columnRef}
            style={
              narrow
                ? { ...styles.column, ...styles.columnFloating, width: `${columnWidth}px` }
                : { ...styles.column, width: `${columnWidth}px` }
            }
            onScroll={onColumnScroll}
          >
            <header style={styles.columnHead}>
              <h4 style={styles.columnTitle}>
                <ListIcon />
                {l10n.t('Variables by frame')}
              </h4>
              <span style={styles.columnCount}>
                {model.frames.length === 1
                  ? l10n.t('1 frame')
                  : l10n.t('{0} frames', model.frames.length)}
              </span>
            </header>
            {model.frames.map((frame) => (
              <section key={frame.id} style={styles.frame}>
                <button
                  type="button"
                  className="dbga-check"
                  aria-pressed={frame.enabled}
                  title={l10n.t("Show this frame's variables in the graph")}
                  onClick={() => toggleFrame(frame.id)}
                >
                  <span className="dbga-box" />
                  <span>{frame.function}</span>
                  <span style={styles.frameLevel}>
                    #{frame.frameLevel}
                    {frame.frameLevel === 0 ? ` ${l10n.t('(current)')}` : ''}
                  </span>
                </button>
                <div style={styles.roots}>
                  {frame.roots.map((root) => (
                    <RootRow
                      key={root.id}
                      root={root}
                      active={root.canvasId !== null && root.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </section>
            ))}
            {model.globals.length > 0 && (
              <section style={styles.globals}>
                <h5 style={styles.globalsTitle}>{l10n.t('File globals')}</h5>
                <div style={styles.roots}>
                  {model.globals.map((root) => (
                    <RootRow
                      key={root.id}
                      root={root}
                      active={root.canvasId !== null && root.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </section>
            )}
          </aside>
          <div
            role="separator"
            aria-orientation="vertical"
            style={
              narrow
                ? { ...styles.divider, ...styles.dividerFloating, left: `${columnWidth}px` }
                : styles.divider
            }
            onMouseDown={startDrag}
          />
        </>
      )}

      <div style={styles.canvas}>
        <div ref={containerRef} style={styles.network} />
        <ColumnButton
          open={panel.columnOpen}
          shown={counts.shown}
          total={counts.total}
          offset={narrow && panel.columnOpen ? columnWidth + 13 : 0}
          onToggle={(columnOpen) => updatePanel({ columnOpen })}
        />
        <ZoomControl
          scale={scale}
          onStep={zoomBy}
          onReset={() => zoomTo(1)}
          onFit={fitAll}
          onFocus={() => focusNodes(aimRef.current)}
          canFocus={aim.length > 0}
        />
        {children}
      </div>
    </>
  );
};

export default GraphView;
