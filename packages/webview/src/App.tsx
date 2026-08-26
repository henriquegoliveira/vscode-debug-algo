import React, { useEffect, useMemo, useRef } from 'react';
import { Edge, Network, Node, Options } from 'vis-network';
import { DataSet } from 'vis-data';
import { toGraph, CanvasEdge, CanvasNode, GraphModel } from './graphModel';
import { useSnapshotChannel } from './state';

const EMPTY_MODEL: GraphModel = { canvas: { nodes: [], edges: [] }, frames: [] };

const NETWORK_OPTIONS: Options = {
  physics: {
    enabled: true,
    barnesHut: { springLength: 140 },
  },
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
  },
};

const App: React.FC = () => {
  const state = useSnapshotChannel();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<DataSet<Node> | null>(null);
  const edgesRef = useRef<DataSet<Edge> | null>(null);

  const model = useMemo(
    () => (state.snapshot === null ? EMPTY_MODEL : toGraph(state.snapshot)),
    [state.snapshot],
  );

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    const nodes = new DataSet<Node>([]);
    const edges = new DataSet<Edge>([]);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const network = new Network(containerRef.current, { nodes, edges }, NETWORK_OPTIONS);

    return () => {
      network.destroy();
      nodesRef.current = null;
      edgesRef.current = null;
    };
  }, []);

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
  }, [model]);

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <h3 style={styles.title}>DbgAlgo - Estrutura de Dados</h3>
      </div>

      {state.error !== null && <div style={styles.errorBanner}>{state.error}</div>}
      {state.phase === 'ended' && <div style={styles.endedBanner}>Sessão encerrada.</div>}

      <div style={styles.body}>
        <aside style={styles.column}>
          <h4 style={styles.columnTitle}>Valores por frame</h4>
          {model.frames.map((frame) => (
            <section key={frame.id} style={styles.frame}>
              <div style={styles.frameTitle}>
                {frame.function} #{frame.frameLevel}
              </div>
              {frame.roots.map((root) => (
                <div key={root.id} style={styles.root}>
                  <span style={styles.rootName}>{root.name}</span>
                  <span style={styles.rootType}>{root.type}</span>
                  <span style={root.status === 'ok' ? styles.rootValue : styles.rootStatus}>
                    {root.status === 'ok' ? root.value : root.status}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </aside>

        <div style={styles.canvas}>
          <div ref={containerRef} style={styles.network} />
          {state.phase === 'idle' && (
            <div style={styles.placeholder}>
              <p style={styles.placeholderLead}>
                A estrutura aparece aqui na primeira pausa da depuração.
              </p>
              <p style={styles.placeholderHint}>Coloque um breakpoint e inicie a depuração.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  body: { flex: 1, display: 'flex', minHeight: 0 },
  column: {
    width: '280px',
    overflowY: 'auto',
    padding: '8px 10px',
    borderRight: '1px solid var(--vscode-editorWidget-border, #333)',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  columnTitle: { margin: '0 0 8px 0', fontSize: '12px', opacity: 0.7 },
  frame: { marginBottom: '10px' },
  frameTitle: { opacity: 0.7, marginBottom: '2px' },
  root: { display: 'flex', gap: '6px', paddingLeft: '8px', whiteSpace: 'nowrap' },
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
};

export default App;
