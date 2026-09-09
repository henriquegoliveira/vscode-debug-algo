import { HEADER_CAPSULE } from './chrome';
import React from 'react';

interface TimelineProps {
  count: number;
  index: number;
  following: boolean;
  compact: boolean;
  onIndex: (index: number) => void;
  onLive: () => void;
}

const Timeline: React.FC<TimelineProps> = ({
  count,
  index,
  following,
  compact,
  onIndex,
  onLive,
}) => {
  const behind = count - 1 - index;

  return (
    <div style={following ? styles.bar : { ...styles.bar, ...styles.barReviewing }}>
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
        style={compact ? { ...styles.range, ...styles.rangeCompact } : styles.range}
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

      <span className="dbga-sep" />

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

const styles: Record<string, React.CSSProperties> = {
  bar: {
    ...HEADER_CAPSULE,
    fontFamily: 'var(--vscode-font-family, sans-serif)',
  },
  range: {
    width: '150px',
    margin: 0,
    accentColor: 'var(--vscode-focusBorder, #007fd4)',
  },
  rangeCompact: { width: '70px' },
  barReviewing: {
    borderColor: 'var(--vscode-inputValidation-warningBorder, #b89500)',
    backgroundColor: 'var(--vscode-inputValidation-warningBackground, #4d3b16)',
  },
};

export default Timeline;
