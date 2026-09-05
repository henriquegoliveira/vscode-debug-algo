import type { TextMeasurer } from './theme';

const SAMPLE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_*[]<>@.,= ';

export function canvasMeasurer(): TextMeasurer {
  const context = document.createElement('canvas').getContext('2d');

  if (context === null) {
    return () => 0;
  }

  return (size, face) => {
    context.font = `${size}px ${face}`;

    const width = context.measureText(SAMPLE).width;

    return Number.isFinite(width) && width > 0 ? width / SAMPLE.length : 0;
  };
}
