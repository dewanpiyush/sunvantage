/**
 * Build Mercator SVG paths for world land — split MultiPolygon for react-native-svg limits.
 */

import { feature } from 'topojson-client';
import type { GeoPermissibleObjects } from 'd3-geo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoLand = any;

const topo: TopoLand = require('world-atlas/land-110m.json');

export function buildWorldLandPaths(
  pathGen: (obj: GeoPermissibleObjects) => string | null
): string[] {
  const land = feature(topo, topo.objects.land);
  const features = land.features ?? [];
  const paths: string[] = [];

  for (const f of features) {
    const geom = f.geometry as { type: string; coordinates: unknown };
    if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates as number[][][][]) {
        const p = pathGen({ type: 'Polygon', coordinates: poly } as GeoPermissibleObjects);
        if (p) paths.push(p);
      }
      continue;
    }
    const p = pathGen(f as GeoPermissibleObjects);
    if (p) paths.push(p);
  }

  return paths;
}
