/**
 * Resolves today's effective sunrise city: habitual home vs temporary active city when away.
 * Loads cache immediately; one silent foreground reconciliation per morning session.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/supabase';
import { getCurrentPosition, reverseGeocodeToCity, type Coords } from '@/lib/location';
import {
  geocodeCityCoordinates,
  getCachedActiveSunriseCityForToday,
  isInMorningRelevanceWindow,
  isMeaningfulDisplacement,
  isAwayFromHomeCity,
  normalizeCityName,
  writeActiveSunriseCityCache,
  clearActiveSunriseCityCache,
} from '@/lib/activeSunriseCity';
import {
  markLocationReconciled,
  releaseReconcileLock,
  shouldRunLocationReconcile,
  subscribeForegroundReconcile,
  tryAcquireReconcileLock,
} from '@/lib/activeSunriseCitySession';
import { getTodayLocalDateString } from '@/lib/streakStats';

type Options = {
  /** Minutes to sunrise for the city currently driving morning context (habitual or cached active). */
  minutesToSunrise?: number | null;
  /** When true, today's log city wins and location refresh is skipped. */
  loggedTodayCity?: string | null;
};

export type UseActiveSunriseCityResult = {
  /** Profile / habitual city — never overwritten by this hook. */
  habitualCity: string | null;
  /** City for today's sunrise card, timing, and logging (null → use habitual). */
  activeSunriseCity: string | null;
  /** Convenience: activeSunriseCity ?? habitualCity */
  sunriseCity: string | null;
  /** True when today's active city differs from habitual. */
  isAwayFromHome: boolean;
};

export function useActiveSunriseCity(
  habitualCityInput: string | null | undefined,
  options?: Options
): UseActiveSunriseCityResult {
  const habitualCity = habitualCityInput?.trim() || null;
  const minutesToSunrise = options?.minutesToSunrise ?? null;
  const loggedTodayCity = options?.loggedTodayCity?.trim() || null;

  const [activeSunriseCity, setActiveSunriseCity] = useState<string | null>(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  // Step 1: hydrate from cache — fast, no GPS.
  useEffect(() => {
    let cancelled = false;
    if (!habitualCity) {
      setActiveSunriseCity(null);
      setCacheHydrated(true);
      return;
    }
    if (loggedTodayCity) {
      setActiveSunriseCity(
        normalizeCityName(loggedTodayCity) !== normalizeCityName(habitualCity) ? loggedTodayCity : null
      );
      setCacheHydrated(true);
      return;
    }
    setCacheHydrated(false);
    void (async () => {
      const cached = await getCachedActiveSunriseCityForToday(habitualCity);
      if (!cancelled) {
        setActiveSunriseCity(cached);
        setCacheHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [habitualCity, loggedTodayCity]);

  const runSilentLocationReconcile = useCallback(async () => {
    if (!habitualCity || loggedTodayCity) return;
    if (!isInMorningRelevanceWindow(minutesToSunrise)) return;
    if (!shouldRunLocationReconcile()) return;
    if (!tryAcquireReconcileLock()) return;

    try {
      const coords = await getCurrentPosition();
      if (!coords) return;

      const resolvedCity = await reverseGeocodeToCity(coords.latitude, coords.longitude);
      if (!resolvedCity?.trim()) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle();

      let habitualCoords: Coords | null = null;
      const pLat = profile?.latitude;
      const pLng = profile?.longitude;
      if (typeof pLat === 'number' && typeof pLng === 'number' && !Number.isNaN(pLat) && !Number.isNaN(pLng)) {
        habitualCoords = { latitude: pLat, longitude: pLng };
      } else {
        habitualCoords = await geocodeCityCoordinates(habitualCity);
      }

      const away = isMeaningfulDisplacement(habitualCity, habitualCoords, resolvedCity, coords);
      const today = getTodayLocalDateString();

      if (away) {
        const nextCity = resolvedCity.trim();
        await writeActiveSunriseCityCache({
          dateYmd: today,
          city: nextCity,
          latitude: coords.latitude,
          longitude: coords.longitude,
          resolvedAt: new Date().toISOString(),
          habitualCity,
        });
        setActiveSunriseCity((prev) => (prev === nextCity ? prev : nextCity));
      } else {
        await clearActiveSunriseCityCache();
        setActiveSunriseCity((prev) => (prev === null ? prev : null));
      }

      markLocationReconciled();
    } catch {
      // quiet — keep cached / habitual context
    } finally {
      releaseReconcileLock();
    }
  }, [habitualCity, loggedTodayCity, minutesToSunrise]);

  // Step 2: one reconciliation when cache is ready (cold open in morning window).
  useEffect(() => {
    if (!cacheHydrated) return;
    void runSilentLocationReconcile();
  }, [cacheHydrated, runSilentLocationReconcile]);

  // Step 3: reconcile again only after full background → foreground (session reset).
  useEffect(() => {
    return subscribeForegroundReconcile(() => {
      void runSilentLocationReconcile();
    });
  }, [runSilentLocationReconcile]);

  const sunriseCity = loggedTodayCity || activeSunriseCity || habitualCity;

  const isAwayFromHome = isAwayFromHomeCity(habitualCity, sunriseCity);

  return {
    habitualCity,
    activeSunriseCity: loggedTodayCity
      ? normalizeCityName(loggedTodayCity) !== normalizeCityName(habitualCity ?? '')
        ? loggedTodayCity
        : null
      : activeSunriseCity,
    sunriseCity,
    isAwayFromHome,
  };
}
