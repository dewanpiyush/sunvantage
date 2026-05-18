/**
 * Today's sunrise progression across Earth (symbolic map geometry).
 *
 * A region is on the "morning arrived" side when local today's sunrise time has passed —
 * including evening (e.g. 6 PM Delhi still counts). This is NOT current sun altitude / daylight.
 */

import SunCalc from 'suncalc';
import type { GeoPermissibleObjects } from 'd3-geo';

const LAT_MIN = -58;
const LAT_MAX = 58;
const LAT_STEP = 3;
const LNG_SEARCH_STEP = 24;

export function normalizeLng(lng: number): number {
  let x = lng % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

/** True when today's local sunrise has already occurred at (lat, lng). */
export function hasMorningArrivedToday(now: Date, lat: number, lng: number): boolean {
  try {
    const times = SunCalc.getTimes(now, lat, lng);
    const sunriseMs = times.sunrise.getTime();
    if (Number.isNaN(sunriseMs)) return false;
    return now.getTime() >= sunriseMs;
  } catch {
    return false;
  }
}

/**
 * Longitude on the sunrise-progression frontier at a given latitude:
 * the boundary between "still before today's sunrise" and "sunrise has passed today".
 */
export function findSunriseProgressionLng(now: Date, lat: number): number | null {
  let prevLng = -180;
  let prevArrived = hasMorningArrivedToday(now, lat, prevLng);
  const crossings: number[] = [];

  for (let lng = -180 + LNG_SEARCH_STEP; lng <= 180; lng += LNG_SEARCH_STEP) {
    const arrived = hasMorningArrivedToday(now, lat, lng);
    if (arrived !== prevArrived) {
      let lo = prevLng;
      let hi = lng;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (hasMorningArrivedToday(now, lat, mid) === prevArrived) lo = mid;
        else hi = mid;
      }
      crossings.push(normalizeLng((lo + hi) / 2));
    }
    prevLng = lng;
    prevArrived = arrived;
  }

  if (crossings.length === 0) {
    return hasMorningArrivedToday(now, lat, 0) ? -180 : 180;
  }
  return crossings[0];
}

function sampleFrontierPoints(now: Date): [number, number][] {
  const points: [number, number][] = [];
  for (let lat = LAT_MAX; lat >= LAT_MIN; lat -= LAT_STEP) {
    const lng = findSunriseProgressionLng(now, lat);
    if (lng != null) points.push([lng, lat]);
  }
  return points;
}

/** Whether "morning arrived" lies east of the progression frontier (Earth's eastward rotation). */
function morningArrivedIsEastOfFrontier(now: Date, frontierLng: number): boolean {
  const lat = 0;
  const west = normalizeLng(frontierLng - 30);
  const east = normalizeLng(frontierLng + 30);
  return !hasMorningArrivedToday(now, lat, west) && hasMorningArrivedToday(now, lat, east);
}

function closeRingAlongMeridian(
  frontier: [number, number][],
  meridian: number
): [number, number][] {
  if (frontier.length < 2) return frontier;
  const south = frontier[frontier.length - 1];
  const north = frontier[0];
  return [...frontier, [meridian, south[1]], [meridian, north[1]], north];
}

/**
 * Polygon for regions where today's sunrise has already occurred.
 */
export function getMorningArrivedRegionGeometry(date: Date): GeoPermissibleObjects | null {
  const frontier = sampleFrontierPoints(date);
  if (frontier.length < 2) return null;

  const refLng = frontier[Math.floor(frontier.length / 2)][0];
  const eastSide = morningArrivedIsEastOfFrontier(date, refLng);
  const ring = eastSide
    ? closeRingAlongMeridian(frontier, 180)
    : closeRingAlongMeridian(frontier, -180);

  return { type: 'Polygon', coordinates: [ring] };
}

/**
 * Polygon for regions still before today's local sunrise.
 */
export function getMorningAwaitingRegionGeometry(date: Date): GeoPermissibleObjects | null {
  const frontier = sampleFrontierPoints(date);
  if (frontier.length < 2) return null;

  const refLng = frontier[Math.floor(frontier.length / 2)][0];
  const eastSide = morningArrivedIsEastOfFrontier(date, refLng);
  const ring = eastSide
    ? closeRingAlongMeridian(frontier, -180)
    : closeRingAlongMeridian(frontier, 180);

  return { type: 'Polygon', coordinates: [ring] };
}

/** Open line along the sunrise-progression frontier (for soft edge glow). */
export function getSunriseProgressionFrontierGeometry(date: Date): GeoPermissibleObjects | null {
  const frontier = sampleFrontierPoints(date);
  if (frontier.length < 2) return null;
  return { type: 'LineString', coordinates: frontier };
}
