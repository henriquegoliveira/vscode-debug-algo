import { PanelState, readPanelState, writePanelState } from './persistence';
import React, { useCallback, useRef, useState } from 'react';

export function usePanelState(): [
  PanelState,
  (patch: Partial<PanelState>) => void,
  React.MutableRefObject<PanelState>,
] {
  const [panel, setPanel] = useState<PanelState>(() => readPanelState());
  const panelRef = useRef<PanelState>(panel);

  const update = useCallback((patch: Partial<PanelState>) => {
    setPanel((current) => {
      const next = { ...current, ...patch };
      panelRef.current = next;
      writePanelState(next);

      return next;
    });
  }, []);

  return [panel, update, panelRef];
}
