/**
 * Sunrise terminator line (day/night boundary) and night shading overlay.
 * Uses same projection as WorldMap so it must receive matching width/height.
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getTerminatorGeometry } from '@/lib/sunTerminator';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

const TERMINATOR_STROKE = '#F4C95D';
const OUTER_GLOW_WIDTH = 8;
const OUTER_GLOW_OPACITY = 0.15;
const INNER_STROKE_WIDTH = 2;
const INNER_STROKE_OPACITY = 0.9;
const NIGHT_FILL = 'rgba(0,0,0,0.35)';

type Props = {
  date: Date;
};

export default function SunriseTerminator({ date }: Props) {
  const { width, height } = useWindowDimensions();

  const { terminatorPath, nightPath } = useMemo(() => {
    const projection = getMapProjection(width, height);
    const pathGen = getGeoPath(projection);
    const geom = getTerminatorGeometry(date);
    const path = pathGen(geom);
    return {
      terminatorPath: path,
      nightPath: path, // same circle; fill = night hemisphere
    };
  }, [width, height, date.getTime()]);

  if (!terminatorPath) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Night hemisphere (filled circle = dark overlay) */}
        <Path
          d={nightPath ?? undefined}
          fill={NIGHT_FILL}
          stroke="none"
        />
        {/* Terminator: outer glow (sunrise band) */}
        <Path
          d={terminatorPath ?? undefined}
          fill="none"
          stroke={TERMINATOR_STROKE}
          strokeWidth={OUTER_GLOW_WIDTH}
          strokeOpacity={OUTER_GLOW_OPACITY}
        />
        {/* Terminator: inner line */}
        <Path
          d={terminatorPath ?? undefined}
          fill="none"
          stroke={TERMINATOR_STROKE}
          strokeWidth={INNER_STROKE_WIDTH}
          strokeOpacity={INNER_STROKE_OPACITY}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
});
