import type { Viewport } from '../geometry/camera';
import { GRID_ALPHA, gridPattern } from '../geometry/grid';
import React from 'react';

const GRID_INK = 'var(--vscode-editorWidget-border, #454545)';

export const GridLayer: React.FC<{ viewport: Viewport }> = ({ viewport }) => {
  const pattern = gridPattern(viewport.scale);
  const half = pattern.size / 2;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: GRID_ALPHA,
        backgroundImage: `radial-gradient(circle at center, ${GRID_INK} ${pattern.radius}px, transparent ${pattern.radius}px)`,
        backgroundSize: `${pattern.size}px ${pattern.size}px`,
        backgroundPosition: `${viewport.x - half}px ${viewport.y - half}px`,
      }}
    />
  );
};
