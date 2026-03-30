import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type BackgroundMode = 'default' | 'postLog';

type UIState = {
  backgroundMode: BackgroundMode;
  setBackgroundMode: (mode: BackgroundMode) => void;
};

const UIStateContext = createContext<UIState | null>(null);

export function UIStateProvider({ children }: { children: React.ReactNode }) {
  const [backgroundMode, setBackgroundModeState] = useState<BackgroundMode>('default');

  const setBackgroundMode = useCallback((mode: BackgroundMode) => {
    setBackgroundModeState(mode);
  }, []);

  const value = useMemo(() => ({ backgroundMode, setBackgroundMode }), [backgroundMode, setBackgroundMode]);

  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIState(): UIState {
  const ctx = useContext(UIStateContext);
  if (!ctx) {
    throw new Error('useUIState must be used within UIStateProvider');
  }
  return ctx;
}

