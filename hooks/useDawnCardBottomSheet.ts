import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

let didClearDismissedForThisJsSession = false;

function getTodayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(day)}`;
}

function getDismissedKey(ymd: string): string {
  return `dawnCardDismissed_${ymd}`;
}

export type UseDawnCardBottomSheetParams = {
  enabled: boolean;
  hasLoggedToday: boolean;
};

/**
 * Visibility rules:
 * - Never show if `hasLoggedToday` is true.
 * - Dismissal is temporary: it persists until the next app open (next JS runtime).
 *
 * We achieve this by clearing the "dismissed today" key once per JS session.
 */
export function useDawnCardBottomSheet({ enabled, hasLoggedToday }: UseDawnCardBottomSheetParams) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      if (hasLoggedToday) {
        setShouldShow(false);
        return;
      }

      try {
        if (!didClearDismissedForThisJsSession) {
          didClearDismissedForThisJsSession = true;
          // Temporary dismissal: clear on the next app open (next JS runtime).
          const ymd = getTodayLocalYmd();
          await AsyncStorage.removeItem(getDismissedKey(ymd));
        }
      } catch {
        // ignore
      }

      try {
        const ymd = getTodayLocalYmd();
        const raw = await AsyncStorage.getItem(getDismissedKey(ymd));
        if (cancelled) return;
        const dismissed = raw === 'true';
        setShouldShow(!dismissed);
      } catch {
        if (cancelled) return;
        setShouldShow(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, hasLoggedToday]);

  const dismiss = useCallback(async () => {
    // Unmount immediately; persist dismissal in the background.
    setShouldShow(false);
    try {
      const ymd = getTodayLocalYmd();
      await AsyncStorage.setItem(getDismissedKey(ymd), 'true');
    } catch {
      // ignore
    }
  }, []);

  return { shouldShow, dismiss };
}

