import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExtractionError } from 'dbga-contract';
import { Edge, Network, Node, Options } from 'vis-network';
import { DataSet } from 'vis-data';
import { toGraph, CanvasEdge, CanvasNode, FrameRoot, GraphModel } from './graphModel';
import { buildIndex, inspect } from './inspection';
import { LayoutKind, layoutForChoice, layoutOptions } from './layout';
import { FALLBACK_THEME, Theme, documentTokenReader, resolveTheme } from './theme';
import { useSnapshotChannel } from './state';
import { isEmbedded, sendAnnotation } from './channel';
import {
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  ViewState,
  readViewState,
  writeViewState,
} from './persistence';
import InspectorOverlay from './InspectorOverlay';
import Toolbar, { ColumnButton } from './Toolbar';

const EMPTY_MODEL: GraphModel = { canvas: { nodes: [], edges: [] }, frames: [] };

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
    arrows: { to: { scaleFactor: 0.6 } },
    width: 1,
    selectionWidth: 1,
  },
};

const App: React.FC = () => {
  const state = useSnapshotChannel();
  const theme = useTheme();
  const [view, updateView, viewRef] = useViewState();

  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLElement>(null);
  const nodesRef = useRef<DataSet<Node> | null>(null);
  const edgesRef = useRef<DataSet<Edge> | null>(null);
  const networkRef = useRef<Network | null>(null);
  const selectedRef = useRef<string | null>(view.selectedId);
  const layoutAppliedRef = useRef<string | null>(null);
  const scrollRestoredRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(view.selectedId);
  const [layout, setLayout] = useState<LayoutKind | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const embedded = isEmbedded();
  const columnWidth = dragWidth ?? view.columnWidth;

  const model = useMemo(
    () =>
      state.snapshot === null
        ? EMPTY_MODEL
        : toGraph(state.snapshot, theme, {
            nullTerminals: view.nullTerminals,
            pinned: layout === 'hierarchical',
          }),
    [state.snapshot, theme, view.nullTerminals, layout],
  );

  const rootCount = useMemo(
    () => model.frames.reduce((total, frame) => total + frame.roots.length, 0),
    [model],
  );

  const index = useMemo(
    () => (state.snapshot === null ? null : buildIndex(state.snapshot)),
    [state.snapshot],
  );

  const inspection = useMemo(
    () => (index === null || selectedId === null ? null : inspect(index, selectedId)),
    [index, selectedId],
  );

  const select = useCallback(
    (id: string | null, reveal = false) => {
      const nodes = nodesRef.current;
      const network = networkRef.current;

      if (id !== null && (nodes === null || nodes.get(id) === null)) {
        return;
      }

      selectedRef.current = id;
      setSelectedId(id);
      updateView({ selectedId: id });

      if (network === null) {
        return;
      }

      if (id === null) {
        network.unselectAll();
        return;
      }

      network.selectNodes([id]);

      if (reveal) {
        network.focus(id, {
          scale: network.getScale(),
          animation: { duration: 300, easingFunction: 'easeInOutQuad' },
        });
      }
    },
    [updateView],
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

    network.on('click', (params: { nodes: string[]; edges: string[] }) => {
      if (params.nodes.length > 0) {
        select(params.nodes[0]);
        return;
      }

      if (params.edges.length === 0) {
        select(null);
      }
    });

    return () => {
      network.destroy();
      networkRef.current = null;
      nodesRef.current = null;
      edgesRef.current = null;
    };
  }, [select]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        select(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [select]);

  useEffect(() => {
    const network = networkRef.current;
    const snapshot = state.snapshot;

    if (network === null || snapshot === null || snapshot.nodes.length === 0) {
      return;
    }

    const choice = view.layoutChoice;
    const key = choice === 'auto' ? `auto:${state.sessionId ?? ''}` : `manual:${choice}`;

    if (layoutAppliedRef.current === key) {
      return;
    }

    const kind = layoutForChoice(choice, snapshot);
    layoutAppliedRef.current = key;
    setLayout(kind);
    network.setOptions(layoutOptions(kind));
  }, [state.snapshot, state.sessionId, view.layoutChoice]);

  useEffect(() => {
    networkRef.current?.redraw();
  }, [columnWidth, view.columnOpen]);

  useEffect(() => {
    const column = columnRef.current;

    if (column === null || scrollRestoredRef.current || model.frames.length === 0) {
      return;
    }

    column.scrollTop = viewRef.current.columnScroll;
    scrollRestoredRef.current = true;
  }, [model, view.columnOpen, viewRef]);

  useEffect(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes === null || edges === null) {
      return;
    }

    remove(edges, model.canvas.edges);
    remove(nodes, model.canvas.nodes);
    nodes.update(model.canvas.nodes as Node[]);
    edges.update(model.canvas.edges as Edge[]);

    const selected = selectedRef.current;
    if (selected === null) {
      return;
    }

    if (nodes.get(selected) === null) {
      selectedRef.current = null;
      setSelectedId(null);
      return;
    }

    networkRef.current?.selectNodes([selected]);
  }, [model]);

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
        updateView({ columnWidth: clamp(up.clientX) });
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [updateView],
  );

  const onColumnScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      writeViewState({ ...viewRef.current, columnScroll: event.currentTarget.scrollTop });
    },
    [viewRef],
  );

  const meta = state.snapshot === null ? null : state.snapshot.meta;
  const loud = meta === null ? [] : meta.errors.filter((error) => !isQuiet(error));
  const quiet = meta === null ? 0 : meta.errors.length - loud.length;
  const signature = meta === null ? '' : JSON.stringify([meta.truncationReasons, loud]);
  const alarming = meta !== null && (meta.truncated || loud.length > 0) && signature !== dismissed;

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <h3 style={styles.title}>DbgAlgo - Estrutura de Dados</h3>
      </div>

      {state.error !== null && <div style={styles.errorBanner}>{state.error}</div>}
      {state.phase === 'ended' && <div style={styles.endedBanner}>Sessão encerrada.</div>}

      {alarming && meta !== null && (
        <div style={styles.alarmBanner}>
          <div style={styles.alarmRows}>
            {meta.truncated && (
              <div style={styles.alarmRow}>
                <span style={styles.alarmScope}>Grafo truncado</span>
                <span>{meta.truncationReasons.join(', ')}</span>
              </div>
            )}
            {loud.map((error, position) => (
              <div key={position} style={styles.alarmRow}>
                <span style={styles.alarmScope}>{error.scope}</span>
                <span style={styles.alarmReference}>{error.reference ?? ''}</span>
                <span>{error.message}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            style={styles.alarmClose}
            title="Fechar o aviso"
            onClick={() => setDismissed(signature)}
          >
            &#10005;
          </button>
        </div>
      )}

      <div ref={bodyRef} style={styles.body}>
        {view.columnOpen && (
          <>
            <aside
              ref={columnRef}
              style={{ ...styles.column, width: `${columnWidth}px` }}
              onScroll={onColumnScroll}
            >
              <h4 style={styles.columnTitle}>Variáveis por frame</h4>
              {model.frames.map((frame) => (
                <section key={frame.id} style={styles.frame}>
                  <div style={styles.frameTitle}>
                    {frame.function} #{frame.frameLevel}
                  </div>
                  {frame.roots.map((root) => (
                    <RootRow
                      key={root.id}
                      root={root}
                      active={root.canvasId !== null && root.canvasId === selectedId}
                      onSelect={select}
                    />
                  ))}
                </section>
              ))}
            </aside>
            <div
              role="separator"
              aria-orientation="vertical"
              style={
                dragWidth === null ? styles.divider : { ...styles.divider, ...styles.dividerOn }
              }
              onMouseDown={startDrag}
            />
          </>
        )}

        <div style={styles.canvas}>
          <div ref={containerRef} style={styles.network} />
          <ColumnButton
            open={view.columnOpen}
            count={rootCount}
            onToggle={(columnOpen) => updateView({ columnOpen })}
          />
          <Toolbar
            choice={view.layoutChoice}
            onChoice={(layoutChoice) => updateView({ layoutChoice })}
            nullTerminals={view.nullTerminals}
            onNullTerminals={(nullTerminals) => updateView({ nullTerminals })}
          />
          {state.phase === 'idle' && (
            <div style={styles.placeholder}>
              <p style={styles.placeholderLead}>
                A estrutura aparece aqui na primeira pausa da depuração.
              </p>
              <p style={styles.placeholderHint}>Coloque um breakpoint e inicie a depuração.</p>
            </div>
          )}
          {inspection !== null && (
            <InspectorOverlay
              inspection={inspection}
              embedded={embedded}
              onAnnotate={sendAnnotation}
              onSelect={(canvasId) => select(canvasId, true)}
              onClose={() => select(null)}
            />
          )}
        </div>
      </div>

      <footer style={styles.footer}>
        <span>{meta === null ? '—' : meta.debugger}</span>
        <span>{meta === null || meta.debuggerVersion === null ? '—' : meta.debuggerVersion}</span>
        <span>framesScanned {meta === null ? '—' : meta.framesScanned}</span>
        <span>framesSkipped {meta === null ? '—' : meta.framesSkipped}</span>
        {quiet > 0 && <span>anotações de outro programa {quiet}</span>}
        <span style={styles.footerLayout}>layout {layout ?? '—'}</span>
      </footer>
    </div>
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
      style={
        active
          ? { ...styles.root, ...styles.rootButton, ...styles.rootActive }
          : { ...styles.root, ...styles.rootButton }
      }
      onClick={() => onSelect(root.canvasId, true)}
    >
      {body}
    </button>
  );
};

function isQuiet(error: ExtractionError): boolean {
  return error.scope === 'annotation' && error.message === 'annotationUnresolved';
}

function rootCell(root: FrameRoot): string {
  if (root.status !== 'ok') {
    return root.status;
  }

  if (root.value !== '') {
    return root.value;
  }

  return root.canvasId !== null ? '→' : '';
}

function useViewState(): [
  ViewState,
  (patch: Partial<ViewState>) => void,
  React.MutableRefObject<ViewState>,
] {
  const [view, setView] = useState<ViewState>(() => readViewState());
  const viewRef = useRef<ViewState>(view);

  const update = useCallback((patch: Partial<ViewState>) => {
    setView((current) => {
      const next = { ...current, ...patch };
      viewRef.current = next;
      writeViewState(next);

      return next;
    });
  }, []);

  return [view, update, viewRef];
}

function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? FALLBACK_THEME : resolveTheme(documentTokenReader()),
  );

  useEffect(() => {
    let pending = 0;

    const refresh = () => {
      pending = 0;
      const next = resolveTheme(documentTokenReader());
      setTheme((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };

    const schedule = () => {
      if (pending === 0) {
        pending = window.requestAnimationFrame(refresh);
      }
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (pending !== 0) {
        window.cancelAnimationFrame(pending);
      }
    };
  }, []);

  return theme;
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
  shell: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    padding: '10px',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    borderBottom: '1px solid var(--vscode-editorWidget-border, #333)',
  },
  title: { margin: 0, textAlign: 'center' },
  errorBanner: {
    padding: '6px 10px',
    backgroundColor: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    borderBottom: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  endedBanner: {
    padding: '6px 10px',
    backgroundColor: 'var(--vscode-editorWidget-background, #2d2d2d)',
    borderBottom: '1px solid var(--vscode-editorWidget-border, #333)',
    fontSize: '12px',
  },
  alarmBanner: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    padding: '6px 10px',
    backgroundColor: 'var(--vscode-inputValidation-warningBackground, #4d3b16)',
    borderBottom: '1px solid var(--vscode-inputValidation-warningBorder, #b89500)',
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '25vh',
    overflowY: 'auto',
  },
  alarmRows: { flex: 1, minWidth: 0 },
  alarmRow: { display: 'flex', gap: '8px', alignItems: 'baseline' },
  alarmClose: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    padding: '0 2px',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  },
  alarmScope: { opacity: 0.7, minWidth: '80px' },
  alarmReference: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  body: { flex: 1, display: 'flex', minHeight: 0 },
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
  dividerOn: { backgroundColor: 'var(--vscode-focusBorder, #007fd4)' },
  columnTitle: { margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 },
  frame: { marginBottom: '10px' },
  frameTitle: { opacity: 0.7, marginBottom: '2px' },
  root: {
    display: 'flex',
    gap: '6px',
    paddingLeft: '8px',
    whiteSpace: 'nowrap',
    alignItems: 'baseline',
  },
  rootButton: {
    width: '100%',
    background: 'none',
    border: 'none',
    borderRadius: '2px',
    padding: '0 2px 0 8px',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'left',
  },
  rootActive: { backgroundColor: 'var(--vscode-list-activeSelectionBackground, #04395e)' },
  rootName: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  rootType: { opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis' },
  rootValue: { marginLeft: 'auto', color: 'var(--vscode-charts-green, #b5cea8)' },
  rootStatus: { marginLeft: 'auto', color: 'var(--vscode-charts-orange, #ce9178)' },
  canvas: { flex: 1, position: 'relative', minWidth: 0 },
  network: { position: 'absolute', inset: 0, outline: 'none' },
  placeholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '0 24px',
    textAlign: 'center',
  },
  placeholderLead: { margin: 0, opacity: 0.75 },
  placeholderHint: { margin: 0, opacity: 0.5, fontSize: '12px' },
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '3px 10px',
    borderTop: '1px solid var(--vscode-editorWidget-border, #333)',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflowX: 'auto',
  },
  footerLabel: { opacity: 0.7 },
  footerLayout: { marginLeft: 'auto' },
};

export default App;
