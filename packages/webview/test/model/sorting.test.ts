import { describe, expect, it } from 'vitest';
import {
  MAX_CELL_WIDTH,
  MIN_CELL_WIDTH,
  defaultTracks,
  markersByIndex,
  sortingModel,
} from '../../src/model/sorting';
import { sortingMergePauses } from '../snapshots';

const ADVANCE = 7;

describe('sortingModel', () => {
  it('builds one track per array node, longest first', () => {
    const [first] = sortingMergePauses();
    const model = sortingModel(first, ADVANCE);

    expect(model.tracks).toHaveLength(first.nodes.filter((node) => node.kind === 'array').length);
    model.tracks.slice(1).forEach((track, index) => {
      expect(track.length).toBeLessThanOrEqual(model.tracks[index].length);
    });
    expect(defaultTracks(model)).toEqual([model.tracks[0].key]);
  });

  it('names a track after the roots that point at it', () => {
    const [first] = sortingMergePauses();
    const list = sortingModel(first, ADVANCE).tracks.find((track) => track.names.includes('list'));

    expect(list).toBeDefined();
    expect(list?.key).toBe(list?.names.join('|'));
  });

  it('keeps cell width within its bounds', () => {
    const [first] = sortingMergePauses();

    sortingModel(first, ADVANCE).tracks.forEach((track) => {
      expect(track.cellWidth).toBeGreaterThanOrEqual(MIN_CELL_WIDTH);
      expect(track.cellWidth).toBeLessThanOrEqual(MAX_CELL_WIDTH);
    });
    sortingModel(first, 1000).tracks.forEach((track) =>
      expect(track.cellWidth).toBe(MAX_CELL_WIDTH),
    );
  });

  it('marks the cells that changed since the previous pause', () => {
    const [first, second] = sortingMergePauses();
    const changed = sortingModel(second, ADVANCE, first).tracks.flatMap((track) => [
      ...track.changed,
    ]);

    expect(changed.length).toBeGreaterThan(0);
    expect(sortingModel(second, ADVANCE).tracks.every((track) => track.changed.size === 0)).toBe(
      true,
    );
  });

  it('places integer roots that fit the array as index markers', () => {
    const [first] = sortingMergePauses();
    const track = sortingModel(first, ADVANCE).tracks[0];
    const byIndex = markersByIndex(track);

    track.markers.forEach((marker) => {
      expect(marker.index).toBeGreaterThanOrEqual(0);
      expect(marker.index).toBeLessThan(track.length);
      expect(byIndex.get(marker.index)).toContain(marker);
    });
  });
});
