/**
 * Dark minimalist 2D world map using react-native-svg and d3-geo.
 * Fills the given width/height; uses Mercator projection.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

const LAND_COLOR = '#141B2D';
const MAP_BG = '#0B0F1A';

const WORLD_GEOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoLand = any;

export default function WorldMap() {
  const { width, height } = useWindowDimensions();
  const [landPaths, setLandPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const pathGen = useMemo(() => {
    const projection = getMapProjection(width, height);
    return getGeoPath(projection);
  }, [width, height]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(WORLD_GEOJSON_URL);
        const topo = (await res.json()) as TopoLand;
        if (cancelled) return;

        // world-atlas land-110m is TopoJSON; we need to convert to GeoJSON and then to path strings.
        // topojson-client: feature(topology, object) returns GeoJSON.
        const topojson = await import('topojson-client');
        const land = (topojson as { feature: (t: unknown, o: unknown) => { features?: Array<{ type: string; geometry: unknown }> } }).feature(topo, topo.objects.land);
        const features = land.features ?? [];
        const paths: string[] = [];
        for (const f of features) {
          const p = pathGen(f as import('d3-geo').GeoPermissibleObjects);
          if (p) paths.push(p);
        }
        if (!cancelled) setLandPaths(paths);
      } catch {
        if (!cancelled) setLandPaths([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathGen]);

  if (landPaths.length === 0 && !loading) {
    // Fallback: simple placeholder so layout still works
    return (
      <View style={[styles.container, { width, height }]}>
        <View style={[styles.placeholder, { width, height }]} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <G>
          {landPaths.map((d, i) => (
            <Path key={i} d={d} fill={LAND_COLOR} stroke="none" />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: MAP_BG,
  },
  placeholder: {
    backgroundColor: MAP_BG,
  },
});
