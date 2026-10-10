import { useEffect, useReducer } from 'react';
import type { ExtensionMessage, GraphSnapshot } from 'dbga-contract';
import { EMPTY_ORIENTATION, type Orientation, foldOrientation } from '../model/orientation';
import { connectSnapshotChannel } from './channel';

export type ScreenPhase = 'idle' | 'live' | 'ended';

export interface ScreenState {
  phase: ScreenPhase;
  sessionId: string | null;
  snapshot: GraphSnapshot | null;
  history: GraphSnapshot[];
  pauses: number;
  orientation: Orientation;
  error: string | null;
  file: string | null;
  fileView: unknown;
}

export const INITIAL_STATE: ScreenState = {
  phase: 'idle',
  sessionId: null,
  snapshot: null,
  history: [],
  pauses: 0,
  orientation: EMPTY_ORIENTATION,
  error: null,
  file: null,
  fileView: null,
};

export function reduce(state: ScreenState, message: ExtensionMessage): ScreenState {
  switch (message.type) {
    case 'snapshot': {
      const same = state.sessionId === message.sessionId;
      const kept = same ? state.history : [];
      const history = [...kept, message.snapshot];
      return {
        ...state,
        phase: 'live',
        sessionId: message.sessionId,
        snapshot: message.snapshot,
        history: history.slice(Math.max(0, history.length - Math.max(1, message.depth))),
        pauses: same ? state.pauses + 1 : 1,
        orientation: foldOrientation(
          same ? state.orientation : EMPTY_ORIENTATION,
          message.snapshot,
        ),
        error: null,
      };
    }
    case 'history': {
      const last = message.entries[message.entries.length - 1] ?? null;
      if (last === null) {
        return state;
      }
      const same = state.sessionId === message.sessionId;
      return {
        ...state,
        phase: 'live',
        sessionId: message.sessionId,
        snapshot: last,
        history: message.entries,
        pauses: same ? Math.max(state.pauses, message.entries.length) : message.entries.length,
        orientation: message.entries.reduce(
          foldOrientation,
          same ? state.orientation : EMPTY_ORIENTATION,
        ),
        error: null,
      };
    }
    case 'view':
      return { ...state, file: message.file, fileView: message.state ?? null };
    case 'sessionEnd':
      return { ...state, phase: 'ended' };
    case 'error':
      return { ...state, error: message.message };
  }
}

export function useSnapshotChannel(): ScreenState {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);

  useEffect(() => connectSnapshotChannel(dispatch), []);

  return state;
}
