import * as l10n from '@vscode/l10n';
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
        title={l10n.t('Previous pause')}
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
        title={l10n.t('Step through the stored pauses')}
        onChange={(event) => onIndex(Number(event.target.value))}
      />

      <button
        type="button"
        className="dbga-icon"
        title={l10n.t('Next pause')}
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
            ? l10n.t('Following the most recent pause')
            : l10n.t('Back to the most recent pause ({0} after this one)', behind)
        }
        onClick={onLive}
      >
        {l10n.t('live')}
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
