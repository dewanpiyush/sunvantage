/**
 * "Sunrise progress" shading for the global map: dark where today's sunrise has not
 * yet occurred, light where it has. Uses SunCalc per (lat, lng); polar edge cases
 * fall back to sun altitude when sunrise time is unavailable.
 */

import SunCalc from 'suncalc';

const LAT_MIN = -70;
const LAT_MAX = 70;
const LAT_STEP = 3;
/** Longitude precision for binary search (degrees). */
const LNG_EPS = 0.25;

export function isSunriseRevealedForMap(now: Date, lat: number, lng: number): boolean {
  const times = SunCalc.getTimes(now, lat, lng);
  const sr = times.sunrise;
  if (sr instanceof Date && !Number.isNaN(sr.getTime())) {
    return now.getTime() >= sr.getTime();
  }
  const { altitude } = SunCalc.getPosition(now, lat, lng);
  return altitude > 0;
}

/**
 * Smallest longitude in [-180, 180] where today's sunrise has passed at this latitude,
 * scanning from west. Used to build the western "unrevealed" cap.
 * Returns -180 if the whole parallel is revealed; 180 if none is revealed.
 */
export function firstRevealedLngFromWest(now: Date, lat: number): number {
  const rW = isSunriseRevealedForMap(now, lat, -180);
  const rE = isSunriseRevealedForMap(now, lat, 180);
  if (rW && rE) return -180;
  if (!rW && !rE) return 180;

  let lo = -180;
  let hi = 180;
  while (hi - lo > LNG_EPS) {
    const mid = (lo + hi) / 2;
    if (isSunriseRevealedForMap(now, lat, mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * GeoJSON Polygon: unrevealed strip west of the sunrise-progress boundary, between
 * LAT_MIN and LAT_MAX (Mercator-safe latitude band).
 */
export function getUnrevealedSunriseProgressPolygon(now: Date): GeoJSON.Polygon {
  const ring: [number, number][] = [];
  ring.push([-180, LAT_MIN], [firstRevealedLngFromWest(now, LAT_MIN), LAT_MIN]);
  for (let lat = LAT_MIN + LAT_STEP; lat <= LAT_MAX; lat += LAT_STEP) {
    ring.push([firstRevealedLngFromWest(now, lat), lat]);
  }
  ring.push([-180, LAT_MAX], [-180, LAT_MIN]);
  return { type: 'Polygon', coordinates: [ring] };
}
