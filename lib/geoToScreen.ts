import { getMapProjection } from './mapProjection';

/**
 * Convert (lat, lng) to map screen (x, y) using the same Mercator projection as the map.
 */
export function geoToScreen(lat: number, lng: number, width: number, height: number): [number, number] | null {
  const projection = getMapProjection(width, height);
  const point = projection([lng, lat]);
  if (point == null || Number.isNaN(point[0]) || Number.isNaN(point[1])) return null;
  return [point[0], point[1]];
}
