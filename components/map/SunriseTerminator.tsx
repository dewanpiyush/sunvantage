/**
 * Global Sunrise Map atmospheric layers.
 * SunriseAtmosphere — below land (night dim + soft dawn wash)
 * SunriseFrontier — above land (single glow curve)
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, G, Defs, ClipPath, Rect, Stop, LinearGradient } from 'react-native-svg';
import {
  getTerminatorGeometry,
  getNightHemisphereGeometry,
  getSubsolarPoint,
  getNightCenter,
} from '@/lib/sunTerminator';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

const FRONTIER_STROKE = '#C8DCF4';
const NIGHT_HEMISPHERE_FILL = 'rgba(3, 8, 18, 0.42)';

const OUTER_GLOW_WIDTH = 9;
const OUTER_GLOW_OPACITY = 0.09;
const MID_GLOW_WIDTH = 4.5;
const MID_GLOW_OPACITY = 0.18;
const CORE_STROKE_WIDTH = 1.1;
const CORE_STROKE_OPACITY = 0.42;

const VIEWPORT_INSET = 8;
const GRADIENT_AXIS_EXTEND = 0.38;
const OCEAN_RGB = '8, 20, 37';
const EDGE_FADE_HEIGHT_RATIO = 0.14;

type Props = {
  date: Date;
  width?: number;
  height?: number;
};

function useTerminatorLayout(date: Date, width: number, height: number) {
  return useMemo(() => {
    const projection = getMapProjection(width, height);
    const pathGen = getGeoPath(projection);

    const frontierPath = pathGen(getTerminatorGeometry(date)) ?? '';
    const nightPath = pathGen(getNightHemisphereGeometry(date)) ?? '';

    const subsolar = getSubsolarPoint(date);
    const nightCenter = getNightCenter(date);
    const dayPt = projection(subsolar);
    const nightPt = projection(nightCenter);

    let gradient = { x1: 0, y1: height / 2, x2: width, y2: height / 2 };

    if (dayPt && nightPt) {
      const dx = dayPt[0] - nightPt[0];
      const dy = dayPt[1] - nightPt[1];
      const len = Math.hypot(dx, dy) || 1;
      const extend = len * GRADIENT_AXIS_EXTEND;
      gradient = {
        x1: nightPt[0] - (dx / len) * extend,
        y1: nightPt[1] - (dy / len) * extend,
        x2: dayPt[0] + (dx / len) * extend,
        y2: dayPt[1] + (dy / len) * extend,
      };
    }

    return { frontierPath, nightPath, gradient };
  }, [date, width, height]);
}

/** Night dim + soft dawn wash — render below continents. */
export function SunriseAtmosphere({ date, width: propWidth, height: propHeight }: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;
  const { nightPath, gradient } = useTerminatorLayout(date, width, height);

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} stroke="none">
        <Defs>
          <LinearGradient
            id="dayReveal"
            x1={gradient.x1}
            y1={gradient.y1}
            x2={gradient.x2}
            y2={gradient.y2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="rgba(3, 8, 18, 0.12)" />
            <Stop offset="0.28" stopColor="rgba(3, 8, 18, 0.04)" />
            <Stop offset="0.42" stopColor="rgba(3, 8, 18, 0)" />
            <Stop offset="0.50" stopColor="rgba(92, 150, 210, 0)" />
            <Stop offset="0.58" stopColor="rgba(110, 145, 185, 0.035)" />
            <Stop offset="0.72" stopColor="rgba(165, 185, 210, 0.055)" />
            <Stop offset="0.86" stopColor="rgba(200, 195, 180, 0.05)" />
            <Stop offset="1" stopColor="rgba(190, 185, 175, 0.06)" />
          </LinearGradient>
          <LinearGradient id="edgeFadeTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgba(${OCEAN_RGB}, 0.72)`} />
            <Stop offset="1" stopColor={`rgba(${OCEAN_RGB}, 0)`} />
          </LinearGradient>
          <LinearGradient id="edgeFadeBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgba(${OCEAN_RGB}, 0)`} />
            <Stop offset="1" stopColor={`rgba(${OCEAN_RGB}, 0.72)`} />
          </LinearGradient>
        </Defs>

        {nightPath ? <Path d={nightPath} fill={NIGHT_HEMISPHERE_FILL} stroke="none" /> : null}
        <Rect x={0} y={0} width={width} height={height} fill="url(#dayReveal)" />
        <Rect x={0} y={0} width={width} height={height * EDGE_FADE_HEIGHT_RATIO} fill="url(#edgeFadeTop)" />
        <Rect
          x={0}
          y={height * (1 - EDGE_FADE_HEIGHT_RATIO)}
          width={width}
          height={height * EDGE_FADE_HEIGHT_RATIO}
          fill="url(#edgeFadeBottom)"
        />
      </Svg>
    </View>
  );
}

/** Single sunrise frontier glow — render above continents. */
export function SunriseFrontier({ date, width: propWidth, height: propHeight }: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;
  const { frontierPath } = useTerminatorLayout(date, width, height);

  if (!frontierPath) return null;

  const inset = VIEWPORT_INSET;
  const clipX = inset;
  const clipY = inset;
  const clipW = width - 2 * inset;
  const clipH = height - 2 * inset;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} stroke="none">
        <Defs>
          <ClipPath id="progressionClip">
            <Rect x={clipX} y={clipY} width={clipW} height={clipH} />
          </ClipPath>
          <LinearGradient id="progressionStroke" x1="0" y1="0" x2={width} y2="0">
            <Stop offset="0" stopColor={FRONTIER_STROKE} stopOpacity="0.18" />
            <Stop offset="0.5" stopColor={FRONTIER_STROKE} stopOpacity="0.45" />
            <Stop offset="1" stopColor={FRONTIER_STROKE} stopOpacity="0.18" />
          </LinearGradient>
        </Defs>

        <G clipPath="url(#progressionClip)">
          <Path
            d={frontierPath}
            fill="none"
            stroke="url(#progressionStroke)"
            strokeWidth={OUTER_GLOW_WIDTH}
            strokeOpacity={OUTER_GLOW_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={frontierPath}
            fill="none"
            stroke="url(#progressionStroke)"
            strokeWidth={MID_GLOW_WIDTH}
            strokeOpacity={MID_GLOW_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={frontierPath}
            fill="none"
            stroke="url(#progressionStroke)"
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
