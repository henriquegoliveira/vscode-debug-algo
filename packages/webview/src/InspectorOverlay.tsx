import React from 'react';
import type {
  ArrayView,
  Entry,
  Inspection,
  NodeInspection,
  RootInspection,
  TerminalInspection,
} from './inspection';
import { TEXT } from './text';

interface Props {
  inspection: Inspection;
  onSelect: (canvasId: string) => void;
  onClose: () => void;
}

type Select = Props['onSelect'];

const InspectorOverlay: React.FC<Props> = ({ inspection, onSelect, onClose }) => (
  <aside style={styles.overlay}>
    <header style={styles.head}>
      <span style={styles.title}>{heading(inspection)}</span>
      <button type="button" style={styles.close} onClick={onClose}>
        {TEXT.closeOverlay}
      </button>
    </header>

    {inspection.space === 'node' && <NodeBody inspection={inspection} onSelect={onSelect} />}
    {inspection.space === 'terminal' && (
      <TerminalBody inspection={inspection} onSelect={onSelect} />
    )}
    {inspection.space === 'root' && <RootBody inspection={inspection} onSelect={onSelect} />}
  </aside>
);

function heading(inspection: Inspection): string {
  if (inspection.space === 'node') {
    return inspection.title;
  }
  if (inspection.space === 'terminal') {
    return 'NULL';
  }

  return inspection.name;
}

const NodeBody: React.FC<{ inspection: NodeInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <div style={styles.address}>{inspection.address}</div>
    <Entries entries={inspection.entries} />

    {inspection.uncertain && <div style={styles.warn}>{TEXT.uncertainRecord}</div>}

    {inspection.errors.map((error, position) => (
      <div key={position} style={styles.warn}>
        {error.message}
      </div>
    ))}

    {inspection.fields.length > 0 && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>fields</h5>
        {inspection.fields.map((field) => (
          <div key={field.name} style={styles.row}>
            <span style={styles.rowName}>{field.name}</span>
            <span style={styles.rowType}>{field.type}</span>
            <span style={styles.rowValue}>{field.value}</span>
          </div>
        ))}
      </section>
    )}

    {inspection.pointers.length > 0 && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>pointers</h5>
        {inspection.pointers.map((pointer) => (
          <div key={pointer.field} style={styles.row}>
            <span style={styles.rowName}>{pointer.field}</span>
            <span style={styles.rowType}>{pointer.type}</span>
            <Target canvasId={pointer.canvasId} onSelect={onSelect} />
          </div>
        ))}
      </section>
    )}

    {inspection.arrays.map((array) => (
      <ArraySection key={array.name} array={array} onSelect={onSelect} />
    ))}
  </>
);

const ArraySection: React.FC<{ array: ArrayView; onSelect: Select }> = ({ array, onSelect }) => (
  <section style={styles.section}>
    <h5 style={styles.sectionTitle}>
      {array.name}[{array.length}] <span style={styles.rowType}>{array.elementType}</span>
    </h5>

    {array.state === 'unexpanded' && <div style={styles.warn}>{TEXT.unexpandedArray}</div>}

    {array.state === 'cells' &&
      array.cells.map((cell) => (
        <div key={cell.index} style={styles.row}>
          <span style={styles.rowIndex}>[{cell.index}]</span>
          <span style={styles.rowValue}>{cell.text}</span>
        </div>
      ))}

    {array.state === 'pointers' &&
      array.targets.map((target) => (
        <div key={target.index} style={styles.row}>
          <span style={styles.rowIndex}>[{target.index}]</span>
          <Target canvasId={target.canvasId} onSelect={onSelect} />
        </div>
      ))}

    {array.truncated && <div style={styles.warn}>{TEXT.truncatedArray}</div>}
  </section>
);

const TerminalBody: React.FC<{ inspection: TerminalInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <div style={styles.address}>{inspection.originAddress}</div>
    <section style={styles.section}>
      <h5 style={styles.sectionTitle}>{inspection.originType}</h5>
      <div style={styles.row}>
        <span style={styles.rowName}>from</span>
        <Target canvasId={inspection.originCanvasId} onSelect={onSelect} />
      </div>
      {inspection.fields.map((field) => (
        <div key={field} style={styles.row}>
          <span style={styles.rowName}>{field}</span>
          <span style={styles.rowNull}>NULL</span>
        </div>
      ))}
    </section>
  </>
);

const RootBody: React.FC<{ inspection: RootInspection; onSelect: Select }> = ({
  inspection,
  onSelect,
}) => (
  <>
    <div style={styles.address}>{inspection.frame}</div>
    <Entries entries={inspection.entries} />

    {inspection.value !== null && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>value</h5>
        <div style={styles.row}>
          <span style={styles.rowValue}>{inspection.value}</span>
        </div>
      </section>
    )}

    {inspection.nodeCanvasId !== null && (
      <section style={styles.section}>
        <h5 style={styles.sectionTitle}>node</h5>
        <div style={styles.row}>
          <Target canvasId={inspection.nodeCanvasId} onSelect={onSelect} />
        </div>
      </section>
    )}
  </>
);

const Entries: React.FC<{ entries: Entry[] }> = ({ entries }) => (
  <section style={styles.section}>
    {entries.map((entry) => (
      <div key={entry.label} style={styles.row}>
        <span style={styles.rowName}>{entry.label}</span>
        <span style={styles.rowValue}>{entry.value}</span>
      </div>
    ))}
  </section>
);

const Target: React.FC<{ canvasId: string | null; onSelect: Select }> = ({ canvasId, onSelect }) =>
  canvasId === null ? (
    <span style={styles.rowNull}>NULL</span>
  ) : (
    <button type="button" style={styles.link} onClick={() => onSelect(canvasId)}>
      {canvasId}
    </button>
  );

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '320px',
    maxHeight: 'calc(100% - 16px)',
    overflowY: 'auto',
    padding: '8px 10px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #454545)',
    borderRadius: '3px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '12px',
  },
  head: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '6px',
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
  },
  title: {
    flex: 1,
    fontWeight: 600,
    wordBreak: 'break-all',
    color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)',
  },
  close: {
    background: 'none',
    border: 'none',
    padding: '0 2px',
    cursor: 'pointer',
    color: 'var(--vscode-descriptionForeground, #a0a0a0)',
    font: 'inherit',
  },
  address: { opacity: 0.6, marginBottom: '6px', wordBreak: 'break-all' },
  section: { marginBottom: '8px' },
  sectionTitle: {
    margin: '0 0 3px 0',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    opacity: 0.6,
    fontWeight: 400,
  },
  row: { display: 'flex', gap: '6px', alignItems: 'baseline', padding: '1px 0' },
  rowName: { color: 'var(--vscode-symbolIcon-fieldForeground, #9cdcfe)', wordBreak: 'break-all' },
  rowIndex: { opacity: 0.55, minWidth: '34px' },
  rowType: { opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowValue: {
    marginLeft: 'auto',
    color: 'var(--vscode-charts-green, #b5cea8)',
    wordBreak: 'break-all',
    textAlign: 'right',
  },
  rowNull: { marginLeft: 'auto', opacity: 0.55 },
  link: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
    textDecoration: 'underline',
    color: 'var(--vscode-textLink-foreground, #3794ff)',
  },
  warn: {
    padding: '3px 6px',
    marginBottom: '6px',
    backgroundColor: 'var(--vscode-inputValidation-warningBackground, #4d3b16)',
    border: '1px solid var(--vscode-inputValidation-warningBorder, #b89500)',
  },
};

export default InspectorOverlay;
