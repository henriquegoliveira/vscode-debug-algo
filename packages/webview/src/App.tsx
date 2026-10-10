import { styles } from './App.styles';
import { changeHighlight, changedNodes } from './model/graph/changes';
import { fileName } from './model/format';
import { frameKey, parseCanvasId } from './model/graph/ids';
import { NO_CHANGES, Pass } from './model/graph/types';
import { annotationTargets, buildIndex, inspect } from './model/inspection';
import { type LayoutChoice, type LayoutKind, resolveLayout } from './model/layoutRule';
import { childSides, treeOrder } from './model/orientation';
import { isEmbedded, sendAnnotation, sendSaveView } from './session/channel';
import {
  FieldChoice,
  FileView,
  FrameMode,
  VIEW_MODES,
  ViewMode,
  coerceFile,
} from './session/persistence';
import { type ScreenPhase, useSnapshotChannel } from './session/state';
import { usePanelState } from './session/usePanelState';
import { ChangeLegend } from './ui/ChangeLegend';
import Timeline from './ui/Timeline';
import Toolbar from './ui/Toolbar';
import { HistoryIcon } from './ui/icons';
import InspectorOverlay from './ui/inspector/InspectorOverlay';
import { useTheme } from './ui/useTheme';
import GraphView from './views/GraphView';
import RecursionView from './views/RecursionView';
import SortingView from './views/SortingView';
import type { ExtractionError, GraphSnapshot } from 'dbga-contract';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const NARROW_WIDTH = 620;

const WIDE_WIDTH = 900;

const PHASE_COLOR: Record<ScreenPhase, string> = {
  idle: 'var(--vscode-descriptionForeground, #a0a0a0)',
  live: 'var(--vscode-charts-green, #89d185)',
  ended: 'var(--vscode-charts-orange, #ce9178)',
};

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
  const editsRef = useRef(edits);
  const [bodyWidth, setBodyWidth] = useState<number | null>(null);
  const [pinned, setPinned] = useState<GraphSnapshot | null>(null);

  const embedded = isEmbedded();
  const narrow = bodyWidth !== null && bodyWidth < NARROW_WIDTH;
  const wide = bodyWidth === null || bodyWidth >= WIDE_WIDTH;

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
    () =>
      index === null || selectedId === null ? null : inspect(index, selectedId, enabledFrames),
    [index, selectedId, enabledFrames],
  );

  const sides = useMemo(() => {
    const type = inspection?.space === 'node' ? inspection.recordType : null;

    return active === null || type === null
      ? []
      : childSides(active, treeOrder(active, state.orientation, fileView.mirrored), type);
  }, [active, inspection, state.orientation, fileView.mirrored]);

  const annotations = useMemo(
    () =>
      index === null || selectedId === null
        ? []
        : annotationTargets(index, selectedId, enabledFrames),
    [index, selectedId, enabledFrames],
  );

  const updateFile = (patch: Partial<FileView>): void => {
    const file = state.file;
    const pending = editsRef.current;
    const base = pending !== null && pending.file === file ? pending.view : fileView;
    const entry = { file, view: { ...base, ...patch } };

    editsRef.current = entry;
    setEdits(entry);

    if (file === null) {
      return;
    }

    updatePanel({ views: { ...panelRef.current.views, [file]: entry.view } });
    sendSaveView(file, entry.view);
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

  const toggleMirror = (type: string): void =>
    updateFile({
      mirrored: fileView.mirrored.includes(type)
        ? fileView.mirrored.filter((entry) => entry !== type)
        : [...fileView.mirrored, type],
    });

  const setViewMode = (mode: ViewMode): void => updateFile({ viewMode: mode });

  const setGraphChoice = (layoutChoice: LayoutChoice): void =>
    updateFile({ viewMode: 'graph', layoutChoice });

  const viewModeRef = useRef(viewMode);
  const updateFileRef = useRef(updateFile);

  useEffect(() => {
    editsRef.current = edits;
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

  const site = pauseSite(active, state.file);

  const behind = state.history.length - 1 - cursor;
  const pauseNumber = state.pauses - behind;
  const dropped = state.pauses - state.history.length;
  const pauseTitle =
    state.pauses === 0
      ? undefined
      : [
          following
            ? `Pausa ${pauseNumber}, a mais recente`
            : `Revisando a pausa ${pauseNumber}, com ${behind} depois dela`,
          dropped > 0
            ? `${state.history.length} guardadas; as ${dropped} primeiras saíram da janela`
            : `${state.history.length} guardadas`,
        ].join(' · ');

  const meta = active === null ? null : active.meta;
  const loud = meta === null ? [] : meta.errors.filter((error) => !isQuiet(error));
  const quiet = meta === null ? 0 : meta.errors.length - loud.length;
  const signature = meta === null ? '' : JSON.stringify([meta.truncationReasons, loud]);
  const alarming = meta !== null && (meta.truncated || loud.length > 0) && signature !== dismissed;

  const overlay = (
    <>
      <Toolbar
        choice={fileView.layoutChoice}
        onGraphChoice={setGraphChoice}
        nullTerminals={fileView.nullTerminals}
        onNullTerminals={(nullTerminals) => updateFile({ nullTerminals })}
        frameMode={fileView.frameMode}
        manual={manual}
        onFrameMode={setFrameMode}
        follow={fileView.follow}
        onFollow={(next) => updateFile({ follow: next })}
        viewMode={viewMode}
        onViewMode={setViewMode}
        compact={!wide}
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
          annotations={annotations}
          embedded={embedded}
          fields={fileView.fields}
          onFieldChoice={setFieldChoice}
          sides={sides}
          mirrored={fileView.mirrored}
          onMirror={toggleMirror}
          onAnnotate={sendAnnotation}
          onSelect={(canvasId) => select(canvasId, true)}
          onClose={() => select(null)}
        />
      )}
    </>
  );

  return (
    <div style={styles.shell}>
      <header style={narrow ? { ...styles.header, ...styles.headerCompact } : styles.header}>
        <div style={styles.pause} title={pauseTitle}>
          {state.pauses > 0 && (
            <>
              <HistoryIcon />
              {!narrow && <span style={styles.pauseLead}>Pausa</span>}
              <span style={styles.pauseNumber}>{pauseNumber}</span>
              {state.pauses > 1 && (
                <span style={styles.pauseTotal}>
                  {narrow ? `/${state.pauses}` : `de ${state.pauses}`}
                </span>
              )}
            </>
          )}
        </div>

        {state.history.length > 1 && (
          <div style={styles.headerMiddle}>
            <Timeline
              count={state.history.length}
              index={cursor}
              following={following}
              compact={!wide}
              onIndex={(next) => setPinned(state.history[next] ?? null)}
              onLive={() => setPinned(null)}
            />
          </div>
        )}

        <div style={styles.headerRight}>
          <div style={styles.site}>
            <span style={{ ...styles.siteDot, backgroundColor: PHASE_COLOR[state.phase] }} />
            {site === null ? (
              <span style={styles.siteLead}>Aguardando a primeira pausa</span>
            ) : (
              <>
                {wide && <span style={styles.siteLead}>Pausado em</span>}
                <span style={styles.siteFunction}>{site.function}()</span>
                {!narrow && (
                  <span style={styles.siteWhere}>
                    linha {site.line}
                    {wide && site.file !== '' ? ` (${site.file})` : ''}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

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
            className="dbga-icon dbga-icon-close"
            style={styles.alarmClose}
            title="Fechar o aviso"
            onClick={() => setDismissed(signature)}
          >
            &#10005;
          </button>
        </div>
      )}

      <div ref={bodyRef} style={styles.body}>
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
            theme={theme}
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
        {!narrow && <span>{state.file ?? active?.frames[0]?.file ?? 'arquivo desconhecido'}</span>}
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

function pauseSite(
  snapshot: GraphSnapshot | null,
  file: string | null,
): { function: string; line: number; file: string } | null {
  const frame = snapshot?.frames[0];

  if (frame === undefined) {
    return null;
  }

  return { function: frame.function, line: frame.line, file: fileName(file ?? frame.file) };
}

function isQuiet(error: ExtractionError): boolean {
  return error.scope === 'annotation' && error.message === 'annotationUnresolved';
}

function hasExplicitViewMode(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return false;
  }

  return VIEW_MODES.includes((raw as Record<string, unknown>).viewMode as ViewMode);
}

export default App;
