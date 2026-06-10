/**
 * Atmospheric legend for the Global Sunrise Map — tokens match map rendering.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { MAP_OCEAN_COLOR } from '@/components/map/WorldMap';

const FRONTIER_STROKE = '#C8DCF4';
const DAWN_DOT = 'rgba(196, 188, 175, 0.88)';
const SWATCH_SIZE = 12;

function SunriseNowSwatch() {
  const y = SWATCH_SIZE / 2;
  return (
    <Svg width={SWATCH_SIZE + 4} height={SWATCH_SIZE} viewBox={`0 0 ${SWATCH_SIZE + 4} ${SWATCH_SIZE}`}>
      <Line
        x1={1}
        y1={y}
        x2={SWATCH_SIZE + 3}
        y2={y - 0.5}
        stroke={FRONTIER_STROKE}
        strokeWidth={3.2}
        strokeOpacity={0.12}
        strokeLinecap="round"
      />
      <Line
        x1={1}
        y1={y}
        x2={SWATCH_SIZE + 3}
        y2={y - 0.5}
        stroke={FRONTIER_STROKE}
        strokeWidth={1.6}
        strokeOpacity={0.28}
        strokeLinecap="round"
      />
      <Line
        x1={1}
        y1={y}
        x2={SWATCH_SIZE + 3}
        y2={y - 0.5}
        stroke={FRONTIER_STROKE}
        strokeWidth={0.7}
        strokeOpacity={0.48}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function NightSwatch() {
  const r = 3.5;
  const c = SWATCH_SIZE / 2 + 1;
  return (
    <Svg width={SWATCH_SIZE + 2} height={SWATCH_SIZE} viewBox={`0 0 ${SWATCH_SIZE + 2} ${SWATCH_SIZE}`}>
      <Circle cx={c} cy={c} r={r} fill={MAP_OCEAN_COLOR} />
      <Circle cx={c} cy={c} r={r} fill="rgba(3, 8, 18, 0.45)" />
    </Svg>
  );
}

function DawnSwatch() {
  const r = 3.5;
  const c = SWATCH_SIZE / 2 + 1;
  return (
    <Svg width={SWATCH_SIZE + 2} height={SWATCH_SIZE} viewBox={`0 0 ${SWATCH_SIZE + 2} ${SWATCH_SIZE}`}>
      <Circle cx={c} cy={c} r={r + 1.5} fill="rgba(165, 185, 210, 0.18)" />
      <Circle cx={c} cy={c} r={r} fill={DAWN_DOT} />
    </Svg>
  );
}

type LegendRowProps = {
  swatch: React.ReactNode;
  label: string;
};

function LegendRow({ swatch, label }: LegendRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.swatchSlot}>{swatch}</View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function MapLegend() {
  return (
    <View style={styles.capsule}>
      <LegendRow swatch={<SunriseNowSwatch />} label="Sunrise now" />
      <LegendRow swatch={<NightSwatch />} label="Morning still ahead" />
      <LegendRow swatch={<DawnSwatch />} label="Morning has arrived" />
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    backgroundColor: 'rgba(5, 12, 24, 0.20)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120, 150, 190, 0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  swatchSlot: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(233, 240, 255, 0.62)',
    letterSpacing: 0.04,
  },
});
