import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  legend: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  legendDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '2px',
  },
};
