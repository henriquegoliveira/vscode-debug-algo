import React from 'react';
import type { GraphSnapshot } from 'dbga-contract';

interface TimelineProps {
  count: number;
  index: number;
  following: boolean;
  snapshot: GraphSnapshot | null;
  onIndex: (index: number) => void;
  onLive: () => void;
}

const Timeline: React.FC<TimelineProps> = ({
  count,
  index,
  following,
  snapshot,
  onIndex,
  onLive,
}) => {
  const behind = count - 1 - index;

  return (
    <div style={following ? styles.bar : { ...styles.bar, ...styles.barReviewing }}>
      {!following && <span style={styles.reviewing}>revendo</span>}

      <button
        type="button"
        className="dbga-icon"
        title="Pausa anterior"
        disabled={index <= 0}
        onClick={() => onIndex(index - 1)}
      >
        &#9664;
      </button>

      <input
        type="range"
        style={styles.range}
        min={0}
        max={count - 1}
        step={1}
        value={index}
        title="Percorrer as pausas guardadas"
        onChange={(event) => onIndex(Number(event.target.value))}
      />

      <button
        type="button"
        className="dbga-icon"
        title="Próxima pausa"
        disabled={index >= count - 1}
        onClick={() => onIndex(index + 1)}
      >
        &#9654;
      </button>

      <span style={styles.label}>
        {index + 1}/{count}
      </span>

      <span style={styles.site}>{siteOf(snapshot)}</span>

      <button
        type="button"
        className="dbga-chip"
        aria-pressed={following}
        title={
          following
            ? 'Acompanhando a pausa mais recente'
            : `Voltar para a pausa mais recente (${behind} depois desta)`
        }
        onClick={onLive}
      >
        ao vivo
      </button>
    </div>
  );
};

function siteOf(snapshot: GraphSnapshot | null): string {
  const frame = snapshot?.frames[0];
  if (frame === undefined) {
    return '';
  }

  return `${frame.function}:${frame.line}`;
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'absolute',
    zIndex: 3,
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 6px',
    maxWidth: 'calc(100% - 360px)',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    border: '1px solid var(--vscode-editorWidget-border, #333)',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    fontFamily: 'var(--vscode-font-family, sans-serif)',
    fontSize: '12px',
  },
  range: { width: '140px', accentColor: 'var(--vscode-focusBorder, #007fd4)' },
  label: { fontFamily: 'monospace', opacity: 0.85, whiteSpace: 'nowrap' },
  site: {
    fontFamily: 'monospace',
    opacity: 0.6,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '220px',
  },
  barReviewing: {
    borderColor: 'var(--vscode-inputValidation-warningBorder, #b89500)',
    boxShadow:
      '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--vscode-inputValidation-warningBorder, #b89500)',
  },
  reviewing: {
    padding: '1px 6px',
    borderRadius: '3px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--vscode-inputValidation-warningBackground, #4d3b16)',
    color: 'var(--vscode-inputValidation-warningBorder, #b89500)',
  },
};

export default Timeline;
