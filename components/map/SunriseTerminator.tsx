/**
 * Atmospheric overlay: today's sunrise progression (not current daylight).
 * - Soft tint where today's sunrise has passed
 * - Gentle dim where morning is still ahead
 * - Thin glow on the progression curve — map stays primary underneath
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Path, G, Defs, ClipPath, Rect, Stop, LinearGradient } from 'react-native-svg';
import {
  getMorningArrivedRegionGeometry,
  getMorningAwaitingRegionGeometry,
  getSunriseProgressionFrontierGeometry,
} from '@/lib/sunriseProgression';
import { getMapProjection, getGeoPath } from '@/lib/mapProjection';

const FRONTIER_STROKE = '#C8DCF4';
const OUTER_GLOW_WIDTH = 12;
const OUTER_GLOW_OPACITY = 0.14;
const MID_GLOW_WIDTH = 6;
const MID_GLOW_OPACITY = 0.26;
const CORE_STROKE_WIDTH = 1.4;
const CORE_STROKE_OPACITY = 0.58;

/** Readable split — continents still show through. */
const MORNING_ARRIVED_FILL = 'rgba(92, 150, 210, 0.11)';
const MORNING_AWAITING_FILL = 'rgba(4, 10, 26, 0.44)';

const VIEWPORT_INSET = 8;

type Props = {
  date: Date;
  width?: number;
  height?: number;
};

export default function SunriseTerminator({ date, width: propWidth, height: propHeight }: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;

  const { arrivedPath, awaitingPath, frontierPath } = useMemo(() => {
    const projection = getMapProjection(width, height);
    const pathGen = getGeoPath(projection);
    const arrived = getMorningArrivedRegionGeometry(date);
    const awaiting = getMorningAwaitingRegionGeometry(date);
    const frontier = getSunriseProgressionFrontierGeometry(date);
    return {
      arrivedPath: arrived ? pathGen(arrived) ?? '' : '',
      awaitingPath: awaiting ? pathGen(awaiting) ?? '' : '',
      frontierPath: frontier ? pathGen(frontier) ?? '' : '',
    };
  }, [width, height, date.getTime()]);

  if (!frontierPath && !arrivedPath) return null;

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
            <Stop offset="0" stopColor={FRONTIER_STROKE} stopOpacity="0.25" />
            <Stop offset="0.5" stopColor={FRONTIER_STROKE} stopOpacity="0.55" />
            <Stop offset="1" stopColor={FRONTIER_STROKE} stopOpacity="0.25" />
          </LinearGradient>
        </Defs>

        {awaitingPath ? <Path d={awaitingPath} fill={MORNING_AWAITING_FILL} stroke="none" /> : null}
        {arrivedPath ? <Path d={arrivedPath} fill={MORNING_ARRIVED_FILL} stroke="none" /> : null}

        {frontierPath ? (
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
        ) : null}
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
