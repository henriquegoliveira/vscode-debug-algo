import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExtractionError, GraphSnapshot } from 'dbga-contract';
import {
  NO_CHANGES,
  Pass,
  changeHighlight,
  changedNodes,
  frameKey,
  parseCanvasId,
} from './graphModel';
import { buildIndex, inspect } from './inspection';
import { type LayoutKind, resolveLayout } from './layout';
import { ChangeKind, FALLBACK_THEME, Theme, documentTokenReader, resolveTheme } from './theme';
import { useSnapshotChannel } from './state';
import { isEmbedded, sendAnnotation, sendSaveView } from './channel';
import {
  FieldChoice,
  FileView,
  FrameMode,
  PanelState,
  VIEW_MODES,
  ViewMode,
  coerceFile,
  readPanelState,
  writePanelState,
} from './persistence';
import InspectorOverlay from './InspectorOverlay';
import Timeline from './Timeline';
import Toolbar from './Toolbar';
import GraphView from './GraphView';
import RecursionView from './RecursionView';
import SortingView from './SortingView';

const NARROW_WIDTH = 620;

const App: React.FC = () => {
  const state = useSnapshotChannel();
  const theme = useTheme();
  const [panel, updatePanel, panelRef] = usePanelState();

  const bodyRef = useRef<HTMLDivElement>(null);
  const revealRequestRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(panel.selectedId);
  const [layout, setLayout] = useState<LayoutKind | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [edits, setEdits] = useState<{ file: string | null; view: FileView } | null>(null);
  const [bodyWidth, setBodyWidth] = useState<number | null>(null);
  const [pinned, setPinned] = useState<GraphSnapshot | null>(null);

  const embedded = isEmbedded();
  const narrow = bodyWidth !== null && bodyWidth < NARROW_WIDTH;

  const pinnedAt = pinned === null ? -1 : state.history.indexOf(pinned);
  const following = pinnedAt < 0;
  const cursor = following ? state.history.length - 1 : pinnedAt;
  const active = state.history[cursor] ?? state.snapshot;
  const view = active === state.snapshot ? state : { ...state, snapshot: active };

  const opening = state.history[0] ?? null;
  const sessionDefault = useMemo<ViewMode | null>(
    () => (opening === null ? null : resolveLayout(opening) === 'default' ? 'recursion' : 'graph'),
    [opening],
  );

  const incoming = useMemo(() => coerceFile(state.fileView), [state.fileView]);
  const cached = state.file === null ? undefined : panel.views[state.file];
  const stored = state.fileView === null ? (cached ?? incoming) : incoming;
  const storedView = edits !== null && edits.file === state.file ? edits.view : stored;

  const untouched = edits === null || edits.file !== state.file;
  const fileView =
    untouched && !hasExplicitViewMode(state.fileView) && sessionDefault !== null
      ? { ...storedView, viewMode: sessionDefault }
      : storedView;
  const viewMode = fileView.viewMode;

  const frameIds = useMemo(
    () =>
      (active?.frames ?? []).map((frame) => ({
        id: frameKey(frame.function, frame.level),
        frameLevel: frame.level,
      })),
    [active],
  );

  const manual = useMemo(
    () => panel.frames !== null && panel.frames.every((id) => frameIds.some((e) => e.id === id)),
    [panel.frames, frameIds],
  );

  const enabledFrames = useMemo(() => {
    if (manual) {
      return new Set(panel.frames as string[]);
    }

    if (fileView.frameMode === 'all') {
      return new Set(frameIds.map((entry) => entry.id));
    }

    return new Set(frameIds.filter((entry) => entry.frameLevel === 0).map((entry) => entry.id));
  }, [manual, panel.frames, fileView.frameMode, frameIds]);

  const before = cursor > 0 ? (state.history[cursor - 1] ?? null) : null;

  const pass = useMemo<Pass>(() => {
    if (active === null) {
      return { changes: NO_CHANGES, first: true, of: null, previous: null };
    }

    return {
      changes: before === null ? NO_CHANGES : changedNodes(before, active),
      first: before === null,
      of: active,
      previous: before,
    };
  }, [before, active]);

  const highlight = useMemo(() => changeHighlight(pass, active), [pass, active]);

  const index = useMemo(() => (active === null ? null : buildIndex(active)), [active]);

  const inspection = useMemo(
    () => (index === null || selectedId === null ? null : inspect(index, selectedId)),
    [index, selectedId],
  );

  const updateFile = (patch: Partial<FileView>): void => {
    const next = { ...fileView, ...patch };
    const file = state.file;

    setEdits({ file, view: next });

    if (file === null) {
      return;
    }

    updatePanel({ views: { ...panelRef.current.views, [file]: next } });
    sendSaveView(file, next);
  };

  const setFrameMode = (frameMode: FrameMode): void => {
    updatePanel({ frames: null });
    updateFile({ frameMode });
  };

  const toggleFrame = (id: string): void => {
    const known = frameIds.map((entry) => entry.id);
    const current = known.filter((entry) => enabledFrames.has(entry));

    updatePanel({
      frames: current.includes(id)
        ? current.filter((entry) => entry !== id)
        : known.filter((entry) => entry === id || current.includes(entry)),
    });
  };

  const setFieldChoice = (type: string, choice: FieldChoice | undefined): void => {
    const fields = { ...fileView.fields };

    if (choice === undefined) {
      delete fields[type];
    } else {
      fields[type] = choice;
    }

    updateFile({ fields });
  };

  const setViewMode = (mode: ViewMode): void => updateFile({ viewMode: mode });

  const viewModeRef = useRef(viewMode);
  const updateFileRef = useRef(updateFile);

  useEffect(() => {
    viewModeRef.current = viewMode;
    updateFileRef.current = updateFile;
  });

  const select = useCallback(
    (id: string | null, reveal = false) => {
      revealRequestRef.current = reveal ? id : null;
      setSelectedId(id);
      updatePanel({ selectedId: id });

      if (id === null || viewModeRef.current !== 'recursion') {
        return;
      }

      const parsed = parseCanvasId(id);
      if (parsed !== null && (parsed.space === 'node' || parsed.space === 'card')) {
        updateFileRef.current({ viewMode: 'graph' });
      }
    },
    [updatePanel],
  );

  const clearStaleSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (body === null || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => setBodyWidth(entries[0].contentRect.width));
    observer.observe(body);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        select(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [select]);

  const meta = active === null ? null : active.meta;
  const loud = meta === null ? [] : meta.errors.filter((error) => !isQuiet(error));
  const quiet = meta === null ? 0 : meta.errors.length - loud.length;
  const signature = meta === null ? '' : JSON.stringify([meta.truncationReasons, loud]);
  const alarming = meta !== null && (meta.truncated || loud.length > 0) && signature !== dismissed;

  const overlay = (
    <>
      <Toolbar
        choice={fileView.layoutChoice}
        onChoice={(layoutChoice) => updateFile({ layoutChoice })}
        nullTerminals={fileView.nullTerminals}
        onNullTerminals={(nullTerminals) => updateFile({ nullTerminals })}
        frameMode={fileView.frameMode}
        manual={manual}
        onFrameMode={setFrameMode}
        follow={fileView.follow}
        onFollow={(next) => updateFile({ follow: next })}
        viewMode={viewMode}
        onViewMode={setViewMode}
        compact={narrow}
      />
      {state.history.length > 1 && (
        <Timeline
          count={state.history.length}
          index={cursor}
          following={following}
          snapshot={active}
          onIndex={(next) => setPinned(state.history[next] ?? null)}
          onLive={() => setPinned(null)}
        />
      )}
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
          fields={fileView.fields}
          onFieldChoice={setFieldChoice}
          onAnnotate={sendAnnotation}
          onSelect={(canvasId) => select(canvasId, true)}
          onClose={() => select(null)}
        />
      )}
    </>
  );

  return (
    <div style={styles.shell}>
      <div style={narrow ? { ...styles.header, ...styles.headerCompact } : styles.header}>
        <h3 style={narrow ? { ...styles.title, ...styles.titleCompact } : styles.title}>
          DbgAlgo - Estrutura de Dados
        </h3>
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
            className="dbga-icon"
            style={styles.alarmClose}
            title="Fechar o aviso"
            onClick={() => setDismissed(signature)}
          >
            &#10005;
          </button>
        </div>
      )}

      <div
        ref={bodyRef}
        style={following ? styles.body : { ...styles.body, ...styles.bodyReviewing }}
      >
        {viewMode === 'graph' && (
          <GraphView
            state={view}
            theme={theme}
            fileView={fileView}
            updateFile={updateFile}
            panel={panel}
            panelRef={panelRef}
            updatePanel={updatePanel}
            bodyRef={bodyRef}
            narrow={narrow}
            bodyWidth={bodyWidth}
            pass={pass}
            selectedId={selectedId}
            onSelect={select}
            onSelectInvalid={clearStaleSelection}
            revealRequestRef={revealRequestRef}
            enabledFrames={enabledFrames}
            toggleFrame={toggleFrame}
            layout={layout}
            setLayout={setLayout}
          >
            {overlay}
          </GraphView>
        )}
        {viewMode === 'recursion' && (
          <RecursionView state={view} pass={pass} selectedId={selectedId} onSelect={select}>
            {overlay}
          </RecursionView>
        )}
        {viewMode === 'sorting' && (
          <SortingView
            state={view}
            pass={pass}
            panel={panel}
            updatePanel={updatePanel}
            enabledFrames={enabledFrames}
            selectedId={selectedId}
            onSelect={select}
          >
            {overlay}
          </SortingView>
        )}
      </div>

      <footer style={styles.footer}>
        <span>{meta === null ? '—' : meta.debugger}</span>
        {!narrow && (
          <span>{meta === null || meta.debuggerVersion === null ? '—' : meta.debuggerVersion}</span>
        )}
        {!narrow && <span>framesScanned {meta === null ? '—' : meta.framesScanned}</span>}
        {!narrow && <span>framesSkipped {meta === null ? '—' : meta.framesSkipped}</span>}
        <span>
          frames {enabledFrames.size}/{frameIds.length}
        </span>
        {!narrow && <span>{state.file ?? 'arquivo desconhecido'}</span>}
        {!embedded && !narrow && <span>sem gravação nesta aba</span>}
        {quiet > 0 && <span>anotações de outro programa {quiet}</span>}
        {highlight.size > 0 && <ChangeLegend changes={highlight} theme={theme} />}
        <span style={styles.footerLayout}>
          {viewMode === 'graph' ? `layout ${layout ?? '—'}` : ''}
        </span>
      </footer>
    </div>
  );
};

const CHANGE_NAMES: Record<ChangeKind, string> = {
  created: 'criado',
  relinked: 'religado',
  valued: 'valor alterado',
};

const ChangeLegend: React.FC<{ changes: Map<string, ChangeKind>; theme: Theme }> = ({
  changes,
  theme,
}) => {
  const tally = new Map<ChangeKind, number>();

  changes.forEach((kind) => tally.set(kind, (tally.get(kind) ?? 0) + 1));

  return (
    <>
      {(['created', 'relinked', 'valued'] as ChangeKind[])
        .filter((kind) => tally.has(kind))
        .map((kind) => (
          <span key={kind} style={styles.legend}>
            <span style={{ ...styles.legendDot, backgroundColor: theme.change[kind] }} />
            {CHANGE_NAMES[kind]} {tally.get(kind)}
          </span>
        ))}
    </>
  );
};

function isQuiet(error: ExtractionError): boolean {
  return error.scope === 'annotation' && error.message === 'annotationUnresolved';
}

function hasExplicitViewMode(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return false;
  }

  return VIEW_MODES.includes((raw as Record<string, unknown>).viewMode as ViewMode);
}

function usePanelState(): [
  PanelState,
  (patch: Partial<PanelState>) => void,
  React.MutableRefObject<PanelState>,
] {
  const [panel, setPanel] = useState<PanelState>(() => readPanelState());
  const panelRef = useRef<PanelState>(panel);

  const update = useCallback((patch: Partial<PanelState>) => {
    setPanel((current) => {
      const next = { ...current, ...patch };
      panelRef.current = next;
      writePanelState(next);

      return next;
    });
  }, []);

  return [panel, update, panelRef];
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

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    padding: '10px',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    borderBottom: '1px solid var(--vscode-editorWidget-border, #333)',
  },
  title: { margin: 0, textAlign: 'center' },
  headerCompact: { padding: '4px 8px' },
  titleCompact: { fontSize: '12px', fontWeight: 600, opacity: 0.8 },
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
  alarmClose: { alignSelf: 'flex-start' },
  alarmScope: { opacity: 0.7, minWidth: '80px' },
  alarmReference: { color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
  body: { flex: 1, display: 'flex', minHeight: 0, position: 'relative' },
  bodyReviewing: {
    outline: '2px solid var(--vscode-inputValidation-warningBorder, #b89500)',
    outlineOffset: '-2px',
  },
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
  footerLayout: { marginLeft: 'auto' },
  legend: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  legendDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '2px',
  },
};

export default App;
