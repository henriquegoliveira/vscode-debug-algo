import type { CSSProperties } from 'react';
import type { ChangeKind } from './theme';

export const styles: Record<string, CSSProperties> = {
  legend: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  legendDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '2px',
    boxSizing: 'border-box',
  },
};

export function legendMark(kind: ChangeKind, color: string): CSSProperties {
  if (kind === 'relinked') {
    return { ...styles.legendDot, border: `1px solid ${color}` };
  }

  if (kind === 'valued') {
    return {
      ...styles.legendDot,
      border: `1px solid ${color}`,
      background: `linear-gradient(90deg, ${color} 50%, transparent 50%)`,
    };
  }

  return { ...styles.legendDot, backgroundColor: color };
}
