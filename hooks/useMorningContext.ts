/**
 * Morning Awareness — useMorningContext
 *
 * Fetches sunrise today/tomorrow, minutes to sunrise, sunrisePassed, earlyMorning,
 * tomorrow's weather, and exploration condition for the given city. Uses cached
 * data per day (see weatherService). Pass options (userId + supabase) to use
 * persisted coordinates and avoid geocoding on every request.
 *
 * Pass user.city from profile. If city is null/empty, no fetch is performed.
 *
 * Temporary: logs morning context to console for verification.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getMorningContext,
  type MorningContext,
  type GetMorningContextOptions,
} from '@/services/weatherService';

/** Live sunrise window: sunriseToday - 10 min to sunriseToday + 10 min. */
export function getSunriseCardTimeMessage(minutesToSunrise: number | null): string | null {
  if (minutesToSunrise == null) return null;
  if (minutesToSunrise > 10) return `${minutesToSunrise} minutes to go.`;
  if (minutesToSunrise >= -10 && minutesToSunrise <= 10) return 'The show is on. Step outside.';
  const timeSinceSunrise = -minutesToSunrise;
  if (timeSinceSunrise < 60) return `${timeSinceSunrise} minutes ago`;
  if (timeSinceSunrise >= 60 && timeSinceSunrise <= 119) return `1 hour ${timeSinceSunrise - 60} minutes ago`;
  if (timeSinceSunrise >= 120 && timeSinceSunrise <= 360) return `${Math.floor(timeSinceSunrise / 60)} hours ago`;
  return 'Earlier this morning';
}

/** Dawn window: sunriseToday - 60 min to sunriseToday + 30 min. */
function computeIsDawnMode(sunriseToday: string | null): boolean {
  if (!sunriseToday || !/^\d{1,2}:\d{2}$/.test(sunriseToday)) return false;
  const [hStr, mStr] = sunriseToday.split(':');
  const h = parseInt(hStr!, 10);
  const m = parseInt(mStr!, 10);
  const now = new Date();
  const sunriseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const dawnStart = new Date(sunriseDate.getTime() - 60 * 60 * 1000);
  const dawnEnd = new Date(sunriseDate.getTime() + 30 * 60 * 1000);
  return now >= dawnStart && now <= dawnEnd;
}

type UseMorningContextResult = {
  sunriseToday: string | null;
  sunriseTomorrow: string | null;
  minutesToSunrise: number | null;
  sunrisePassed: boolean | null;
  earlyMorning: boolean | null;
  tomorrowWeather: MorningContext['tomorrowWeather'] | null;
  condition: MorningContext['condition'] | null;
  isDawnMode: boolean;
  sunriseCardTimeMessage: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useMorningContext(
  city: string | null | undefined,
  options?: GetMorningContextOptions
): UseMorningContextResult {
  const [context, setContext] = useState<MorningContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    const c = city?.trim();
    if (!c) {
      setContext(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getMorningContext(c, options);
      setContext(data ?? null);
      if (data) {
        console.log('[SunVantage Morning Context]', {
          sunriseToday: data.sunriseToday,
          sunriseTomorrow: data.sunriseTomorrow,
          minutesToSunrise: data.minutesToSunrise,
          sunrisePassed: data.sunrisePassed,
          earlyMorning: data.earlyMorning,
          tomorrowWeather: data.tomorrowWeather,
          condition: data.condition,
        });
      } else {
        console.warn('[SunVantage] useMorningContext: no data for city', c);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load morning context';
      setError(message);
      setContext(null);
      console.warn('[SunVantage] useMorningContext error:', message);
    } finally {
      setLoading(false);
    }
  }, [city, options?.userId, options?.supabase]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const sunriseToday = context?.sunriseToday ?? null;
  const minutesToSunrise = context?.minutesToSunrise ?? null;
  const isDawnMode = computeIsDawnMode(sunriseToday);
  const sunriseCardTimeMessage = getSunriseCardTimeMessage(minutesToSunrise);

  return {
    sunriseToday,
    sunriseTomorrow: context?.sunriseTomorrow ?? null,
    minutesToSunrise,
    sunrisePassed: context?.sunrisePassed ?? null,
    earlyMorning: context?.earlyMorning ?? null,
    tomorrowWeather: context?.tomorrowWeather ?? null,
    condition: context?.condition ?? null,
    isDawnMode,
    sunriseCardTimeMessage,
    loading,
    error,
    refresh: fetchContext,
  };
}
