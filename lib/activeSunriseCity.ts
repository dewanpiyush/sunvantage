/**
 * Lightweight “today’s sunrise geography” — temporary active city when away from home.
 * Does not mutate profile city. Cached per calendar day.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coords } from '@/lib/location';
import { getTodayLocalDateString } from '@/lib/streakStats';

const STORAGE_KEY = 'sunvantage_active_sunrise_city_v1';
const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

/** ~80 km — meaningful displacement without over-triggering metro sprawl. */
export const ACTIVE_CITY_DISTANCE_KM = 80;

/** 90 min before sunrise through 90 min after. */
export const MORNING_WINDOW_BEFORE_MIN = 90;
export const MORNING_WINDOW_AFTER_MIN = 90;

/** Allow one extra reconciliation after this idle gap (no timer polling). */
export const RECONCILE_STALE_MS = 75 * 60 * 1000;

export type ActiveSunriseCityCache = {
  dateYmd: string;
  city: string;
  latitude: number;
  longitude: number;
  resolvedAt: string;
  habitualCity: string;
};

export function normalizeCityName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function citiesMeaningfullyDiffer(a: string, b: string): boolean {
  const na = normalizeCityName(a);
  const nb = normalizeCityName(b);
  if (!na || !nb) return false;
  if (na === nb) return false;
  if (na.includes(nb) || nb.includes(na)) return false;
  return true;
}

export function haversineDistanceKm(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInMorningRelevanceWindow(minutesToSunrise: number | null): boolean {
  if (minutesToSunrise == null) return false;
  return minutesToSunrise <= MORNING_WINDOW_BEFORE_MIN && minutesToSunrise >= -MORNING_WINDOW_AFTER_MIN;
}

export function isMeaningfulDisplacement(
  habitualCity: string,
  habitualCoords: Coords | null,
  resolvedCity: string,
  resolvedCoords: Coords
): boolean {
  if (citiesMeaningfullyDiffer(habitualCity, resolvedCity)) return true;
  if (!habitualCoords) return false;
  return haversineDistanceKm(habitualCoords, resolvedCoords) > ACTIVE_CITY_DISTANCE_KM;
}

export async function readActiveSunriseCityCache(): Promise<ActiveSunriseCityCache | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSunriseCityCache;
    if (
      !parsed?.dateYmd ||
      !parsed.city?.trim() ||
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeActiveSunriseCityCache(entry: ActiveSunriseCityCache): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export async function clearActiveSunriseCityCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Active city for today if cache matches date + habitual home city. */
export async function getCachedActiveSunriseCityForToday(
  habitualCity: string | null | undefined
): Promise<string | null> {
  const home = habitualCity?.trim();
  if (!home) return null;
  const cache = await readActiveSunriseCityCache();
  if (!cache) return null;
  const today = getTodayLocalDateString();
  if (cache.dateYmd !== today) return null;
  if (normalizeCityName(cache.habitualCity) !== normalizeCityName(home)) return null;
  if (normalizeCityName(cache.city) === normalizeCityName(home)) return null;
  return cache.city.trim();
}

export async function geocodeCityCoordinates(city: string): Promise<Coords | null> {
  const trimmed = city?.trim();
  if (!trimmed) return null;
  try {
    const params = new URLSearchParams({
      name: trimmed,
      count: '1',
      language: 'en',
      format: 'json',
    });
    const res = await fetch(`${GEOCODE_BASE}?${params.toString()}`);
    const data = await res.json();
    const first = data?.results?.[0];
    if (first?.latitude == null || first?.longitude == null) return null;
    return { latitude: first.latitude, longitude: first.longitude };
  } catch {
    return null;
  }
}

const AWAY_COPY_POOL = [
  'The sunrise finds you somewhere new today.',
  'Every city reveals the morning differently.',
  'A different horizon holds the light today.',
] as const;

export function pickAwayFromHomeCopy(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % AWAY_COPY_POOL.length;
  }
  return AWAY_COPY_POOL[hash] ?? AWAY_COPY_POOL[0];
}
