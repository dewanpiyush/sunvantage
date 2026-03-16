/**
 * Sunrise terminator line (day/night boundary) and night shading overlay.
 * Uses same projection as WorldMap so it must receive matching width/height.
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, Rect, G, Defs, ClipPath } from 'react-native-svg';
import { getTerminatorGeometry } from '@/lib/sunTerminator';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

const TERMINATOR_STROKE = '#F4C95D';
// Layered glow band: outer → mid → core
const OUTER_GLOW_WIDTH = 14;
const OUTER_GLOW_OPACITY = 0.08;
const MID_GLOW_WIDTH = 8;
const MID_GLOW_OPACITY = 0.18;
const CORE_STROKE_WIDTH = 2;
const CORE_STROKE_OPACITY = 0.9;
const NIGHT_FILL = 'rgba(0,0,0,0.28)';
const DAY_WARM_OVERLAY = 'rgba(244,201,93,0.07)';
/** Inset so terminator stroke never touches viewport edge (no visible gold frame). */
const VIEWPORT_INSET = 14;
/**
 * Extra top inset to ensure no horizontal gold line is visible where the
 * terminator crosses the top edge of the map container. Slightly larger
 * than before so the stroke is fully clipped off-screen.
 */
const TOP_INSET_EXTRA = 32;

type Props = {
  date: Date;
  width?: number;
  height?: number;
};

export default function SunriseTerminator({ date, width: propWidth, height: propHeight }: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;

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

  const inset = VIEWPORT_INSET;
  const topInset = inset + TOP_INSET_EXTRA;
  const clipX = inset;
  const clipY = topInset;
  const clipW = width - 2 * inset;
  const clipH = height - inset - topInset;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} stroke="none">
        <Defs>
          <ClipPath id="terminatorClip">
            <Rect x={clipX} y={clipY} width={clipW} height={clipH} />
          </ClipPath>
        </Defs>
        {/* Subtle warm overlay on daylight side (rect under night circle so day shows through) */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={DAY_WARM_OVERLAY}
          stroke="none"
        />
        {/* Night hemisphere (filled circle = dark overlay) */}
        <Path
          d={nightPath ?? undefined}
          fill={NIGHT_FILL}
          stroke="none"
        />
        {/* Terminator strokes clipped so they never touch viewport edge (no gold frame) */}
        <G clipPath="url(#terminatorClip)">
          {/* Outer glow */}
          <Path
            d={terminatorPath ?? undefined}
            fill="none"
            stroke={TERMINATOR_STROKE}
            strokeWidth={OUTER_GLOW_WIDTH}
            strokeOpacity={OUTER_GLOW_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Mid glow */}
          <Path
            d={terminatorPath ?? undefined}
            fill="none"
            stroke={TERMINATOR_STROKE}
            strokeWidth={MID_GLOW_WIDTH}
            strokeOpacity={MID_GLOW_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Core sunrise line */}
          <Path
            d={terminatorPath ?? undefined}
            fill="none"
            stroke={TERMINATOR_STROKE}
            strokeWidth={CORE_STROKE_WIDTH}
            strokeOpacity={CORE_STROKE_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
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
