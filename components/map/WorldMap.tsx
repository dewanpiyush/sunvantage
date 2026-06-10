/**
 * Dark minimalist 2D world map using react-native-svg and d3-geo.
 * Fills the given width/height; uses Mercator projection.
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';
import { buildWorldLandPaths } from '@/lib/worldMapLand';

export const MAP_OCEAN_COLOR = '#081425';
export const MAP_LAND_COLOR = '#556B8E';

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

  const landPaths = useMemo(() => {
    try {
      const pathGen = getGeoPath(getMapProjection(width, height));
      return buildWorldLandPaths(pathGen);
    } catch (e) {
      if (__DEV__) {
        console.warn('[WorldMap] failed to build land paths', e);
      }
      return [];
    }
  }, [width, height]);

  const containerStyle = [
    landOnly ? styles.landLayer : styles.fullLayer,
    { width, height, backgroundColor: landOnly ? 'transparent' : MAP_OCEAN_COLOR },
  ];

  if (landPaths.length === 0) {
    return <View style={containerStyle} />;
  }

  return (
    <View style={containerStyle} pointerEvents="none">
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

const styles = StyleSheet.create({
  fullLayer: {},
  landLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
