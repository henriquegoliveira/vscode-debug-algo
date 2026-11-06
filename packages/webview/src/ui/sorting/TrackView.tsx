import * as l10n from '@vscode/l10n';
import { type ArrayTrack, markersByIndex } from '../../model/sorting';
import { CELL_HEIGHT, CUT_ROOM, INDEX_HEIGHT, MARKER_HEIGHT, styles } from './SortingView.styles';
import React from 'react';

export const TrackView: React.FC<{
  track: ArrayTrack;
  hidden: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null, reveal?: boolean) => void;
  trackRef: (el: HTMLDivElement | null) => void;
}> = ({ track, hidden, selectedId, onSelect, trackRef }) => {
  const stacks = [...markersByIndex(track).values()]
    .map((list) => list.filter((marker) => !hidden.has(marker.id)))
    .filter((list) => list.length > 0);
  const depth = stacks.reduce((most, list) => Math.max(most, list.length), 0);
  const width = track.cells.length * track.step + (track.truncated ? CUT_ROOM : 0);
  const height = CELL_HEIGHT + INDEX_HEIGHT + depth * MARKER_HEIGHT;

  return (
    <div ref={trackRef} style={styles.track}>
      <div style={styles.trackHead}>
        <button
          type="button"
          className="dbga-row"
          aria-pressed={track.canvasId === selectedId}
          onClick={() => onSelect(track.canvasId, true)}
        >
          <span style={styles.trackNames}>
            {track.names.length === 0 ? track.type : track.names.join(', ')}
          </span>
          <span style={styles.trackType}>{track.type}</span>
          {track.truncated && (
            <span style={styles.trackTruncated}>
              {l10n.t('{0} of {1}', track.cells.length, track.length)}
            </span>
          )}
        </button>
      </div>

      <div style={styles.trackBody}>
        <div style={{ ...styles.ribbon, width, height }}>
          {track.cells.map((cell) => (
            <span
              key={`i${cell.index}`}
              style={{
                ...styles.cellIndex,
                width: track.cellWidth,
                transform: `translateX(${cell.index * track.step}px)`,
              }}
            >
              {cell.index}
            </span>
          ))}

          {track.cells.map((cell) => (
            <div
              key={cell.slot}
              style={{
                ...(cell.changed ? { ...styles.cell, ...styles.cellChanged } : styles.cell),
                width: track.cellWidth,
                transform: `translateX(${cell.index * track.step}px)`,
              }}
            >
              {cell.text}
            </div>
          ))}

          {stacks.flatMap((list) =>
            list.map((marker, position) => (
              <button
                key={marker.id}
                type="button"
                className="dbga-marker"
                aria-pressed={marker.id === selectedId}
                style={{
                  ...styles.marker,
                  width: track.cellWidth,
                  top: CELL_HEIGHT + INDEX_HEIGHT + position * MARKER_HEIGHT,
                  transform: `translateX(${marker.index * track.step}px)`,
                }}
                title={`${marker.function} #${marker.frameLevel}`}
                onClick={() => onSelect(marker.id, true)}
              >
                {marker.name}
              </button>
            )),
          )}

          {track.truncated && (
            <span
              style={{
                ...styles.cut,
                transform: `translateX(${track.cells.length * track.step}px)`,
              }}
              title={l10n.t(
                '{0} positions beyond the read limit',
                track.length - track.cells.length,
              )}
            >
              +{track.length - track.cells.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
