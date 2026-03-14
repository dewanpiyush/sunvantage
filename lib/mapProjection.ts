import { geoMercator, geoPath } from 'd3-geo';

/**
 * Shared Mercator projection for the global map.
 * Use the same width/height in WorldMap and SunriseTerminator so they align.
 */
export function getMapProjection(width: number, height: number) {
  return geoMercator()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
    .center([0, 20]);
}

export function getGeoPath(projection: ReturnType<typeof geoMercator>) {
  return geoPath().projection(projection);
}
