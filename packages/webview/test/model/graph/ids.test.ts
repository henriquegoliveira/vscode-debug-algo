import { describe, expect, it } from 'vitest';
import {
  cardCanvasId,
  nodeCanvasId,
  parseCanvasId,
  rootCanvasId,
  terminalCanvasId,
} from '../../../src/model/graph/ids';
import { pointerRoot } from '../../snapshots';

describe('canvas ids', () => {
  it('round-trips every id space through parseCanvasId', () => {
    expect(parseCanvasId(nodeCanvasId('0x10'))).toEqual({ space: 'node', address: '0x10' });
    expect(parseCanvasId(terminalCanvasId('0x10'))).toEqual({ space: 'terminal', address: '0x10' });
    expect(parseCanvasId(cardCanvasId('0x10'))).toEqual({ space: 'card', address: '0x10' });
    expect(parseCanvasId(rootCanvasId(pointerRoot('head', '0x10', 1)))).toEqual({
      space: 'root',
      address: 'main#1:head',
    });
  });

  it('gives roots with the same name in different frames different ids', () => {
    expect(rootCanvasId(pointerRoot('head', '0x10', 0))).not.toBe(
      rootCanvasId(pointerRoot('head', '0x10', 1)),
    );
  });

  it('returns null for an id outside the known spaces', () => {
    expect(parseCanvasId('e:0x10:next')).toBeNull();
  });
});
