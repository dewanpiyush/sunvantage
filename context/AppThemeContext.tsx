import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDawnPalette, type AppAppearanceMode, type DawnPalette } from '@/constants/theme';

const STORAGE_KEY = 'sunvantage_appearance_mode';

type AppThemeContextValue = {
  mode: AppAppearanceMode;
  setMode: (mode: AppAppearanceMode) => void;
  /** React-Native color scheme mapping used by existing themed utilities. */
  colorScheme: 'light' | 'dark';
  dawn: DawnPalette;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  // Default behavior: Night Calm (matches current UI).
  const [mode, setModeState] = useState<AppAppearanceMode>('night-calm');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw === 'morning-light' || raw === 'night-calm') {
          setModeState(raw);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: AppAppearanceMode) => {
    setModeState(next);
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
    })();
  }, []);

  const value = useMemo<AppThemeContextValue>(() => {
    const colorScheme: 'light' | 'dark' = mode === 'morning-light' ? 'light' : 'dark';
    return {
      mode,
      setMode,
      colorScheme,
      dawn: getDawnPalette(mode),
    };
  }, [mode, setMode]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    return {
      mode: 'night-calm',
      setMode: () => {},
      colorScheme: 'dark',
      dawn: getDawnPalette('night-calm'),
    };
  }
  return ctx;
}

