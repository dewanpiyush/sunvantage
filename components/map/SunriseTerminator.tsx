/**
 * Solar terminator overlay:
 * - Base: soft warm tint (day / “revealed” feel).
 * - Night hemisphere: dimmed fill from real geometry (antipode of subsolar, 90° radius).
 * - Terminator arc: outer / mid / core stroke — “sunrise now” boundary (animated by parent).
 *
 * Uses the same Mercator projection as WorldMap via getMapProjection / getGeoPath.
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, Rect, G, Defs, ClipPath, LinearGradient, Stop } from 'react-native-svg';
import { getTerminatorGeometry, getNightHemisphereGeometry } from '@/lib/sunTerminator';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

const TERMINATOR_STROKE = '#F4C95D';
const OUTER_GLOW_WIDTH = 14;
const OUTER_GLOW_OPACITY = 0.08;
const MID_GLOW_WIDTH = 8;
const MID_GLOW_OPACITY = 0.18;
const CORE_STROKE_WIDTH = 2;
const CORE_STROKE_OPACITY = 0.9;
const DAY_BASE_FILL = 'rgba(244, 201, 93, 0.06)';
const NIGHT_HEMISPHERE_FILL = 'rgba(0, 0, 0, 0.32)';

/** Inset so terminator stroke never touches viewport edge (no visible gold frame). */
const VIEWPORT_INSET = 10;
/** Extra top inset so horizontal terminator segments at top are clipped. */
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

  const { terminatorPath, nightHemispherePath } = useMemo(() => {
    const projection = getMapProjection(width, height);
    const pathGen = getGeoPath(projection);
    const termPath = pathGen(getTerminatorGeometry(date));
    const nightPath = pathGen(getNightHemisphereGeometry(date)) ?? '';
    return {
      terminatorPath: termPath,
      nightHemispherePath: nightPath,
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
          <LinearGradient id="sunriseStroke" x1="0" y1="0" x2={width} y2="0">
            <Stop offset="0" stopColor={TERMINATOR_STROKE} stopOpacity="0.65" />
            <Stop offset="0.5" stopColor={TERMINATOR_STROKE} stopOpacity="1" />
            <Stop offset="1" stopColor={TERMINATOR_STROKE} stopOpacity="0.65" />
          </LinearGradient>
        </Defs>

        {/* Base: soft day warmth (full map). */}
        <Rect x={0} y={0} width={width} height={height} fill={DAY_BASE_FILL} stroke="none" />
        {/* Night hemisphere: real spherical geometry. */}
        {nightHemispherePath ? <Path d={nightHemispherePath} fill={NIGHT_HEMISPHERE_FILL} stroke="none" /> : null}

        {/* Terminator glow + core (curved sunrise line). */}
        <G clipPath="url(#terminatorClip)">
          <Path
            d={terminatorPath ?? undefined}
            fill="none"
            stroke="url(#sunriseStroke)"
            strokeWidth={OUTER_GLOW_WIDTH}
            strokeOpacity={OUTER_GLOW_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={terminatorPath ?? undefined}
            fill="none"
            stroke="url(#sunriseStroke)"
            strokeWidth={MID_GLOW_WIDTH}
            strokeOpacity={MID_GLOW_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={terminatorPath ?? undefined}
            fill="none"
            stroke="url(#sunriseStroke)"
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
