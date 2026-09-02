import { useEffect, useReducer } from 'react';
import type { ExtensionMessage, GraphSnapshot } from 'dbga-contract';
import { connectSnapshotChannel } from './channel';

export type ScreenPhase = 'idle' | 'live' | 'ended';

export interface ScreenState {
  phase: ScreenPhase;
  sessionId: string | null;
  snapshot: GraphSnapshot | null;
  history: GraphSnapshot[];
  error: string | null;
  file: string | null;
  fileView: unknown;
}

export const INITIAL_STATE: ScreenState = {
  phase: 'idle',
  sessionId: null,
  snapshot: null,
  history: [],
  error: null,
  file: null,
  fileView: null,
};

export function reduce(state: ScreenState, message: ExtensionMessage): ScreenState {
  switch (message.type) {
    case 'snapshot': {
      const kept = state.sessionId === message.sessionId ? state.history : [];
      const history = [...kept, message.snapshot];
      return {
        ...state,
        phase: 'live',
        sessionId: message.sessionId,
        snapshot: message.snapshot,
        history: history.slice(Math.max(0, history.length - Math.max(1, message.depth))),
        error: null,
      };
    }
    case 'history': {
      const last = message.entries[message.entries.length - 1] ?? null;
      if (last === null) {
        return state;
      }
      return {
        ...state,
        phase: 'live',
        sessionId: message.sessionId,
        snapshot: last,
        history: message.entries,
        error: null,
      };
    }
    case 'view':
      return { ...state, file: message.file, fileView: message.state };
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
