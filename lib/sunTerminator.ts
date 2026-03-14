/**
 * Solar terminator (day/night boundary) and subsolar point.
 * Uses UTC for consistency; terminator is drawn with d3-geo.
 */

import { geoCircle, type GeoPermissibleObjects } from 'd3-geo';

/** Subsolar point [longitude, latitude] in degrees */
export function getSubsolarPoint(date: Date): [number, number] {
  const utc = date.getTime();
  const day = new Date(utc);
  const n = day.getUTCDate() + (day.getUTCHours() + day.getUTCMinutes() / 60 + day.getUTCSeconds() / 3600) / 24;
  const year = day.getUTCFullYear();
  const start = Date.UTC(year, 0, 0) / 86400000;
  const dayOfYear = n - start;

  // Fractional year in radians (NOAA-style)
  const gamma = (2 * Math.PI / 365.25) * (dayOfYear - 1 + (day.getUTCHours() - 12) / 24);

  // Solar declination (radians) - simplified
  const decl = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI / 365.25) * (dayOfYear - 81));

  // Equation of time (minutes) - simplified
  const eqTime = 9.87 * Math.sin(2 * gamma) - 7.53 * Math.cos(gamma) - 1.5 * Math.sin(gamma);

  // Subsolar longitude: at 12 UTC (solar noon) at 0°; 15° per hour
  const subsolarLng = 180 - (day.getUTCHours() + day.getUTCMinutes() / 60 + day.getUTCSeconds() / 3600) * 15 - eqTime / 4;
  const subsolarLat = (decl * 180) / Math.PI;

  return [normalizeLng(subsolarLng), subsolarLat];
}

function normalizeLng(lng: number): number {
  let x = lng % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

/** Antipode of [lng, lat] */
function antipode([lng, lat]: [number, number]): [number, number] {
  return [normalizeLng(lng + 180), -lat];
}

/**
 * Returns GeoJSON-like object for the terminator circle (day/night boundary).
 * Terminator = circle centered on the antipode of the subsolar point with radius 90°.
 */
export function getTerminatorGeometry(date: Date): GeoPermissibleObjects {
  const subsolar = getSubsolarPoint(date);
  const nightCenter = antipode(subsolar);
  const circle = geoCircle().center(nightCenter).radius(90).precision(2);
  return circle();
}

