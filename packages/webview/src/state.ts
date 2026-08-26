import { useEffect, useReducer } from 'react';
import type { ExtensionMessage, GraphSnapshot } from 'dbga-contract';
import { connectSnapshotChannel } from './channel';

export type ScreenPhase = 'idle' | 'live' | 'ended';

export interface ScreenState {
  phase: ScreenPhase;
  sessionId: string | null;
  snapshot: GraphSnapshot | null;
  error: string | null;
}

export const INITIAL_STATE: ScreenState = {
  phase: 'idle',
  sessionId: null,
  snapshot: null,
  error: null,
};

export function reduce(state: ScreenState, message: ExtensionMessage): ScreenState {
  switch (message.type) {
    case 'snapshot':
      return {
        phase: 'live',
        sessionId: message.sessionId,
        snapshot: message.snapshot,
        error: null,
      };
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
