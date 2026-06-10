/**
 * Dark minimalist 2D world map using react-native-svg and d3-geo.
 * Fills the given width/height; uses Mercator projection.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

export const MAP_OCEAN_COLOR = '#081425';
export const MAP_LAND_COLOR = '#556B8E';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoLand = any;

type Props = {
  width?: number;
  height?: number;
  /** When true, only land paths render (transparent background) for layered map stack. */
  landOnly?: boolean;
};

export default function WorldMap({
  width: propWidth,
  height: propHeight,
  landOnly = false,
}: Props = {}) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;
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
        const topo = require('world-atlas/land-110m.json') as TopoLand;
        if (cancelled) return;

        const topojson = await import('topojson-client');
        const land = (
          topojson as {
            feature: (t: unknown, o: unknown) => { features?: Array<{ type: string; geometry: unknown }> };
          }
        ).feature(topo, topo.objects.land);
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

  const containerStyle = { backgroundColor: landOnly ? 'transparent' : MAP_OCEAN_COLOR };

  if (landPaths.length === 0 && !loading) {
    return <View style={[containerStyle, { width, height }]} />;
  }

  return (
    <View style={[containerStyle, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} stroke="none">
        <G stroke="none">
          {landPaths.map((d, i) => (
            <Path key={i} d={d} fill={MAP_LAND_COLOR} stroke="none" />
          ))}
        </G>
      </Svg>
    </View>
  );
}
