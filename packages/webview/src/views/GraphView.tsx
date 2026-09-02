import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Edge, Network, Node, Options } from 'vis-network';
import { DataSet } from 'vis-data';
import {
  toGraph,
  ARROW_SCALE,
  CanvasEdge,
  CanvasNode,
  DRIFT_TOLERANCE,
  FrameRoot,
  GraphModel,
  Pass,
  changeHighlight,
  focusTarget,
  rootCell,
  rootFollowers,
  visibleSnapshot,
} from '../model/graph';
import { type Box, labelBox } from '../geometry/boxes';
import { LayoutKind, layoutForChoice, layoutOptions, promotes } from '../model/layout';
import { Theme } from '../ui/theme';
import type { ScreenState } from '../session/state';
import {
  FileView,
  MAX_COLUMN_WIDTH,
  MAX_SCALE,
  MIN_COLUMN_WIDTH,
  MIN_SCALE,
  PanelState,
  writePanelState,
} from '../session/persistence';
import {
  CAMERA_DURATION,
  Viewport,
  cameraPlan,
  interpolate,
  settled,
  steppedScale,
} from '../geometry/camera';
import { ColumnButton, ZOOM_STEP, ZoomControl } from '../ui/Toolbar';

const EMPTY_MODEL: GraphModel = {
  canvas: { nodes: [], edges: [] },
  frames: [],
  globals: [],
  cards: [],
};

const EMPTY_BOX: Box = { width: 0, height: 0 };

const FOCUS_FILL = 0.9;
const FOCUS_MIN_SHARE = 0.25;
const FOCUS_MIN_SCALE = 0.3;
const FOCUS_MAX_SCALE = 1;
const FIT_MIN_SCALE = 0.05;
const GESTURE_SLOP = 4;

const NETWORK_OPTIONS: Options = {
  interaction: {
    hover: false,
    tooltipDelay: 0,
  },
  nodes: {
    borderWidth: 1,
    margin: { top: 8, right: 10, bottom: 8, left: 10 },
  },
  edges: {
    font: { align: 'horizontal' },
    arrows: { to: { scaleFactor: ARROW_SCALE } },
    width: 1,
    selectionWidth: 1,
  },
};

interface Seat {
  x: number;
  y: number;
}

interface Trail {
  anchors: Map<string, Seat>;
  followers: Map<string, Seat>;
}

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
  const layoutRenderedRef = useRef<LayoutKind | null>(null);
  const trailRef = useRef<Trail | null>(null);
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
          }),
    [
      state.snapshot,
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

  const frameOn = useCallback(
    (ids: string[], floor: number, lazy: boolean): void => {
      const network = networkRef.current;
      const box = containerRef.current;

      if (network === null || box === null || ids.length === 0) {
        return;
      }

      const placed = network.getPositions(ids);
      const boxes = boxesRef.current;
      const seats = ids
        .map((id) => {
          const at = placed[id];

          return at === undefined ? null : { id, at, box: boxes.get(id) ?? EMPTY_BOX };
        })
        .filter((seat): seat is { id: string; at: Seat; box: Box } => seat !== null);

      if (seats.length === 0) {
        return;
      }

      const extent = {
        left: Math.min(...seats.map((seat) => seat.at.x - seat.box.width / 2)),
        right: Math.max(...seats.map((seat) => seat.at.x + seat.box.width / 2)),
        top: Math.min(...seats.map((seat) => seat.at.y - seat.box.height / 2)),
        bottom: Math.max(...seats.map((seat) => seat.at.y + seat.box.height / 2)),
      };

      glide(
        cameraPlan(
          extent,
          { width: box.clientWidth, height: box.clientHeight },
          network.getScale(),
          {
            fill: FOCUS_FILL,
            floor,
            ceiling: FOCUS_MAX_SCALE,
            share: FOCUS_MIN_SHARE,
            lazy,
          },
        ),
      );
    },
    [glide],
  );

  const revealNodes = useCallback(
    (ids: string[]) => frameOn(ids, FOCUS_MIN_SCALE, true),
    [frameOn],
  );

  const fitAll = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes === null) {
      return;
    }

    frameOn(nodes.getIds() as string[], FIT_MIN_SCALE, false);
  }, [frameOn]);

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

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      {
        ...NETWORK_OPTIONS,
        ...layoutOptions('default'),
      },
    );
    networkRef.current = network;

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
      network.destroy();
      networkRef.current = null;
      nodesRef.current = null;
      edgesRef.current = null;
    };
  }, [onSelect, panelRef]);

  useEffect(() => {
    followRef.current = follow;
    releaseRef.current = () => updateFile({ follow: false });
  });

  useEffect(() => {
    revealRef.current = (id: string) => {
      const network = networkRef.current;
      if (network === null) {
        return;
      }

      const at = network.getPositions([id])[id];
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
    const kind = layoutForChoice(choice, visibleSnapshot(snapshot, enabledFrames));
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
    boxesRef.current = new Map(
      model.canvas.nodes.map((node) => [node.id, labelBox(node.label, node.kind)] as const),
    );

    if (layout === null && model.canvas.nodes.length > 0) {
      return;
    }

    const placed = networkRef.current?.getPositions() ?? {};
    const authoritative = layout === 'hierarchical';
    const relayout = layoutRenderedRef.current !== layout;
    layoutRenderedRef.current = layout;

    const payload = model.canvas.nodes.map((node) => {
      if (node.x === undefined || node.y === undefined) {
        return node;
      }

      const at = placed[node.id];
      if (at === undefined || relayout) {
        return node;
      }

      if (!authoritative) {
        return withoutSeat(node);
      }

      return Math.hypot(at.x - node.x, at.y - node.y) > DRIFT_TOLERANCE ? node : withoutSeat(node);
    });

    remove(edges, model.canvas.edges);
    remove(nodes, model.canvas.nodes);
    nodes.update(payload as Node[]);
    edges.update(model.canvas.edges as Edge[]);

    const network = networkRef.current;
    if (network === null) {
      return;
    }

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
  }, [model, layout, selectedId, onSelectInvalid, revealRequestRef]);

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

    if (pass.first) {
      const saved = restoredRef.current ? null : panelRef.current.camera;
      restoredRef.current = true;

      if (saved === null) {
        fitAll();
        return;
      }

      network.moveTo({ position: { x: saved.x, y: saved.y }, scale: saved.scale });
      setScale(saved.scale);
      return;
    }

    if (!follow || aim.length === 0) {
      return;
    }

    revealNodes(aim);
  }, [model, layout, follow, aim, revealNodes, fitAll, pass, state.snapshot, panelRef]);

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
            <h4 style={styles.columnTitle}>Variáveis por frame</h4>
            {model.frames.map((frame) => (
              <section key={frame.id} style={styles.frame}>
                <button
                  type="button"
                  className="dbga-check"
                  aria-pressed={frame.enabled}
                  title="Mostrar as variáveis deste frame no grafo"
                  onClick={() => toggleFrame(frame.id)}
                >
                  <span>{frame.enabled ? '☑' : '☐'}</span>
                  <span>
                    {frame.function} #{frame.frameLevel}
                  </span>
                </button>
                {frame.roots.map((root) => (
                  <RootRow
                    key={root.id}
                    root={root}
                    active={root.canvasId !== null && root.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </section>
            ))}
            {model.globals.length > 0 && (
              <section style={styles.frame}>
                <h5 style={styles.columnTitle}>Globais do arquivo</h5>
                {model.globals.map((root) => (
                  <RootRow
                    key={root.id}
                    root={root}
                    active={root.canvasId !== null && root.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
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
          onFocus={() => revealNodes(aimRef.current)}
          canFocus={aim.length > 0}
        />
        {children}
      </div>
    </>
  );
};

const RootRow: React.FC<{
  root: FrameRoot;
  active: boolean;
  onSelect: (id: string | null, reveal?: boolean) => void;
}> = ({ root, active, onSelect }) => {
  const cell = rootCell(root);
  const body = (
    <>
      <span style={styles.rootName}>{root.name}</span>
      <span style={styles.rootType}>{root.type}</span>
      <span style={root.status === 'ok' ? styles.rootValue : styles.rootStatus}>{cell}</span>
    </>
  );

  if (root.canvasId === null) {
    return <div style={styles.root}>{body}</div>;
  }

  return (
    <button
      type="button"
      className="dbga-row"
      aria-pressed={active}
      onClick={() => onSelect(root.id, true)}
    >
      {body}
    </button>
  );
};

function withoutSeat(node: CanvasNode): CanvasNode {
  const copy = { ...node };
  delete copy.x;
  delete copy.y;

  return copy;
}

function remove<T extends Node | Edge>(
  dataSet: DataSet<T>,
  next: (CanvasNode | CanvasEdge)[],
): void {
  const keep = new Set(next.map((item) => item.id));
  const stale = (dataSet.getIds() as string[]).filter((id) => !keep.has(id));

  if (stale.length > 0) {
    dataSet.remove(stale);
  }
}

const styles: Record<string, React.CSSProperties> = {
  column: {
    flex: '0 0 auto',
    overflowY: 'auto',
    padding: '8px 10px',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  divider: {
    flex: '0 0 auto',
    width: '5px',
    cursor: 'col-resize',
    backgroundColor: 'var(--vscode-editorWidget-border, #333)',
  },
  columnFloating: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    borderRight: '1px solid var(--vscode-editorWidget-border, #333)',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.35)',
  },
  dividerFloating: { position: 'absolute', zIndex: 3, top: 0, bottom: 0 },
  columnTitle: { margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 },
  frame: { marginBottom: '10px' },
  root: {
    display: 'flex',
    gap: '6px',
    paddingLeft: '8px',
    whiteSpace: 'nowrap',
    alignItems: 'baseline',
  },
  rootName: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  rootType: { opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis' },
  rootValue: { marginLeft: 'auto', color: 'var(--vscode-charts-green, #b5cea8)' },
  rootStatus: { marginLeft: 'auto', color: 'var(--vscode-charts-orange, #ce9178)' },
  canvas: { flex: 1, position: 'relative', minWidth: 0 },
  network: { position: 'absolute', inset: 0, outline: 'none' },
};

export default GraphView;
