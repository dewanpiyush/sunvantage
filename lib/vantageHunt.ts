/**
 * Vantage Hunt — dawn-only ritual for choosing where to meet the sunrise.
 * Foreground GPS snapshots only; no route tracking.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coords } from '@/lib/location';
import { haversineDistanceKm } from '@/lib/activeSunriseCity';
import { reverseGeocodeToCity, reverseGeocodeToPlaceName } from '@/lib/location';
import { getTodayLocalDateString } from '@/lib/streakStats';

export const HUNT_WINDOW_BEFORE_MIN = 90;
export const HUNT_WINDOW_AFTER_MIN = 45;

/** When true, hunt entry is not gated by the dawn window (QA). Set false for production. */
export const HUNT_WINDOW_OVERRIDE_FOR_TESTING = true;

export const HUNT_STORAGE_KEY = 'sunvantage_vantage_hunt_v1';

export type HuntMovementMode = 'walk' | 'cycle' | 'vehicle';

export type VantageHuntPhase = 'intention' | 'transit';

export type VantageHuntSession = {
  dateYmd: string;
  phase: VantageHuntPhase;
  movementMode: HuntMovementMode;
  huntStartCoordinates: Coords;
  huntStartTimestamp: string;
  predawnImageUri?: string | null;
  predawnImageCapturedAt?: string | null;
};

export type VantageArrival = {
  vantageCoordinates: Coords;
  vantageCity: string | null;
  vantageLabel: string;
  displacementMeters: number;
};

export function isInVantageHuntWindow(minutesToSunrise: number | null): boolean {
  if (HUNT_WINDOW_OVERRIDE_FOR_TESTING) return true;
  if (minutesToSunrise == null) return false;
  return (
    minutesToSunrise <= HUNT_WINDOW_BEFORE_MIN && minutesToSunrise >= -HUNT_WINDOW_AFTER_MIN
  );
}

export type VantageHuntHomePhase = 'pre' | 'live' | 'post';

export type VantageHuntHomeCardCopy = {
  title: string;
  body: string;
  bodySecondary: string | null;
  cta: string;
  meta: string | null;
  footer: string | null;
  showCountdown: boolean;
};

/** Home card copy — dawn, live window, and retrospective within the hunt window. */
export function getVantageHuntHomeCardCopy(
  phase: VantageHuntHomePhase,
  sunriseTimeLabel: string,
  city: string | null
): VantageHuntHomeCardCopy {
  const place = city?.trim() || 'your city';
  const footer = 'Every vantage reveals the morning differently.';

  if (phase === 'live') {
    return {
      title: 'Vantage Hunt',
      body: 'The light is arriving.',
      bodySecondary: 'Choose where to meet it today.',
      cta: 'Begin the hunt',
      meta: `Sunrise at ${sunriseTimeLabel} · ${place}`,
      footer,
      showCountdown: true,
    };
  }

  if (phase === 'post') {
    return {
      title: 'Found a new vantage?',
      body: 'If you stepped out at dawn',
      bodySecondary: 'and moved somewhere new.',
      cta: "Share today's hunt",
      meta: null,
      footer: null,
      showCountdown: false,
    };
  }

  return {
    title: 'Find a new vantage',
    body: 'Step out before dawn.',
    bodySecondary: 'Walk toward somewhere new.',
    cta: 'Begin the hunt',
    meta: `Sunrise at ${sunriseTimeLabel} · ${place}`,
    footer,
    showCountdown: true,
  };
}

/** Post live window — retrospective hunt / log from home. */
export function isVantageHuntRetrospective(minutesToSunrise: number | null): boolean {
  return minutesToSunrise != null && minutesToSunrise < -20;
}

/** Hide “min since sunrise” when an hour or more has passed. */
export function shouldShowHuntCountdown(minutesToSunrise: number | null): boolean {
  if (minutesToSunrise == null) return false;
  if (minutesToSunrise >= 0) return true;
  return Math.abs(minutesToSunrise) < 61;
}

export type VantageHuntIntentionCopy = {
  bodyLead: string;
  movementLabel: string;
  cta: string;
  headerSubtitle: string;
};

export function getVantageHuntIntentionCopy(
  minutesToSunrise: number | null
): VantageHuntIntentionCopy {
  if (isVantageHuntRetrospective(minutesToSunrise)) {
    return {
      bodyLead: 'You were up at Sunrise today.',
      movementLabel: 'How did you move?',
      cta: 'Log the hunt',
      headerSubtitle: 'Sharing where the light found you.',
    };
  }
  return {
    bodyLead: 'You are up before the light.',
    movementLabel: 'How are you moving?',
    cta: 'Begin the hunt',
    headerSubtitle: 'Choosing where to meet the light.',
  };
}

export function aerialDisplacementMeters(a: Coords, b: Coords): number {
  return Math.round(haversineDistanceKm(a, b) * 1000);
}

export function getDisplacementCopy(meters: number): string {
  if (meters < 150) return 'You welcomed the sunrise nearby today.';
  if (meters < 800) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return `You moved ${rounded}m from your usual morning.`;
  }
  return 'You sought a different horizon today.';
}

export function getMovementModeLabel(mode: HuntMovementMode): string {
  switch (mode) {
    case 'walk':
      return 'Walked to this morning';
    case 'cycle':
      return 'Cycled to this morning';
    case 'vehicle':
      return 'Welcomed from a new vantage';
  }
}

/** Subtle post-log line for memory cards (optional). */
export function formatHuntMemoryMeta(
  mode: HuntMovementMode,
  displacementMeters: number | null | undefined
): string | null {
  const modeLine = getMovementModeLabel(mode);
  if (displacementMeters != null && displacementMeters >= 150) {
    return `${modeLine} · ${getDisplacementCopy(displacementMeters)}`;
  }
  return modeLine;
}

export function resolveVantageLabel(placeName: string | null, city: string | null): string {
  if (placeName?.trim()) return placeName.trim();
  if (city?.trim()) return city.trim();
  return "Today's vantage";
}

export async function loadVantageHuntSession(): Promise<VantageHuntSession | null> {
  try {
    const raw = await AsyncStorage.getItem(HUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VantageHuntSession;
    if (parsed.dateYmd !== getTodayLocalDateString()) {
      await clearVantageHuntSession();
      return null;
    }
    if (!parsed.huntStartCoordinates || !parsed.movementMode || !parsed.phase) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveVantageHuntSession(session: VantageHuntSession): Promise<void> {
  await AsyncStorage.setItem(HUNT_STORAGE_KEY, JSON.stringify(session));
}

export async function clearVantageHuntSession(): Promise<void> {
  await AsyncStorage.removeItem(HUNT_STORAGE_KEY);
}

/** Retrospective log — single GPS point, no hunt displacement. */
export async function resolveRetrospectiveVantage(coords: Coords): Promise<VantageArrival> {
  const [placeName, city] = await Promise.all([
    reverseGeocodeToPlaceName(coords.latitude, coords.longitude),
    reverseGeocodeToCity(coords.latitude, coords.longitude),
  ]);
  return {
    vantageCoordinates: coords,
    vantageCity: city,
    vantageLabel: resolveVantageLabel(placeName, city),
    displacementMeters: 0,
  };
}

export async function resolveVantageArrival(
  start: Coords,
  vantage: Coords
): Promise<VantageArrival> {
  const [placeName, city] = await Promise.all([
    reverseGeocodeToPlaceName(vantage.latitude, vantage.longitude),
    reverseGeocodeToCity(vantage.latitude, vantage.longitude),
  ]);
  const displacementMeters = aerialDisplacementMeters(start, vantage);
  const vantageLabel = resolveVantageLabel(placeName, city);
  return {
    vantageCoordinates: vantage,
    vantageCity: city,
    vantageLabel,
    displacementMeters,
  };
}

/** Lighter transit header countdown — “Sunrise in ~18 min”. */
export function formatHuntTransitCountdown(minutesToSunrise: number | null): string {
  if (minutesToSunrise == null) return 'Sunrise soon';
  if (minutesToSunrise > 0) {
    if (minutesToSunrise >= 60) {
      const h = Math.floor(minutesToSunrise / 60);
      const m = minutesToSunrise % 60;
      if (m === 0) return `Sunrise in ~${h}h`;
      return `Sunrise in ~${h}h ${m}m`;
    }
    return `Sunrise in ~${minutesToSunrise} min`;
  }
  if (minutesToSunrise >= -1) return 'Sunrise now';
  const after = Math.abs(minutesToSunrise);
  return `Sunrise ~${after} min ago`;
}

export function formatPredawnCapturedTime(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatHuntCountdown(minutesToSunrise: number | null): string {
  if (minutesToSunrise == null) return '—';
  if (minutesToSunrise > 0) {
    if (minutesToSunrise >= 60) {
      const h = Math.floor(minutesToSunrise / 60);
      const m = minutesToSunrise % 60;
      return m > 0 ? `${h}h ${m}m to sunrise` : `${h}h to sunrise`;
    }
    return `${minutesToSunrise} min to sunrise`;
  }
  const after = Math.abs(minutesToSunrise);
  if (after <= 1) return 'Sunrise now';
  return `${after} min since sunrise`;
}
