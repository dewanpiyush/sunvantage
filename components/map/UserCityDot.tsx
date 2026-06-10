/**
 * Current user's today log on the map — green pin at actual log location, not profile home.
 */

import React, { useMemo, useState } from 'react';
import { View, Pressable, Modal, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import SunCalc from 'suncalc';
import { format } from 'date-fns';
import { useWindowDimensions } from 'react-native';
import { geoToScreen } from '@/lib/geoToScreen';
import { Dawn } from '@/constants/theme';

const USER_DOT_INNER_RADIUS = 3.2;
const USER_DOT_RING_RADIUS = 4.2;
const USER_DOT_RING_WIDTH = 1.8;
const USER_DOT_FILL = '#5FAF7A';
const USER_DOT_RING_COLOR = '#8FD4A8';
const USER_DOT_GLOW_COLOR = '#4DA67A';
const USER_DOT_SCALE = 1.05;
const USER_DOT_GLOW_RADIUS = 9;
const USER_DOT_GLOW_OPACITY = 0.22;
const USER_DOT_OUTER_RING_RADIUS = 8.5;
const USER_DOT_OUTER_RING_OPACITY = 0.24;
const LABEL_OFFSET_Y = 10;

export type UserCity = {
  city: string;
  lat: number;
  lng: number;
};

type Props = {
  city: UserCity;
  now: Date;
  width?: number;
  height?: number;
};

export default function UserCityDot({ city, now, width: propWidth, height: propHeight }: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;
  const [modalVisible, setModalVisible] = useState(false);

  const xy = useMemo(
    () => geoToScreen(city.lat, city.lng, width, height),
    [city.lat, city.lng, width, height]
  );

  const times = useMemo(() => {
    const times = SunCalc.getTimes(now, city.lat, city.lng);
    return {
      sunrise: times.sunrise,
      sunriseEnd: times.sunriseEnd,
    };
  }, [now.getTime(), city.lat, city.lng]);

  const sunriseFormatted = format(times.sunrise, 'h:mm a');
  const hasRisen = now >= times.sunrise;
  const timeToSunrise = times.sunrise.getTime() - now.getTime();
  const hoursToGo = Math.max(0, Math.floor(timeToSunrise / (1000 * 60 * 60)));

  if (xy == null) return null;

  return (
    <>
      <Pressable
        style={[styles.hitArea, { left: xy[0] - 22, top: xy[1] - 22, width: 44, height: 44 }]}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`You welcomed the morning in ${city.city}`}
      />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Circle
          cx={xy[0]}
          cy={xy[1]}
          r={USER_DOT_GLOW_RADIUS}
          fill={USER_DOT_GLOW_COLOR}
          opacity={USER_DOT_GLOW_OPACITY}
        />
        <Circle
          cx={xy[0]}
          cy={xy[1]}
          r={USER_DOT_OUTER_RING_RADIUS}
          fill="none"
          stroke={USER_DOT_GLOW_COLOR}
          strokeWidth={1}
          opacity={USER_DOT_OUTER_RING_OPACITY}
        />
        <Circle cx={xy[0]} cy={xy[1]} r={USER_DOT_INNER_RADIUS * USER_DOT_SCALE} fill={USER_DOT_FILL} />
        <Circle
          cx={xy[0]}
          cy={xy[1]}
          r={USER_DOT_RING_RADIUS * USER_DOT_SCALE}
          fill="none"
          stroke={USER_DOT_RING_COLOR}
          strokeWidth={USER_DOT_RING_WIDTH}
        />
      </Svg>
      <View
        style={[
          styles.labelWrap,
          {
            left: xy[0] - 28,
            top: xy[1] + LABEL_OFFSET_Y,
            width: 56,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.youLabel}>You</Text>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalCity}>{city.city}</Text>
            <Text style={styles.modalSub}>You welcomed the morning here.</Text>
            <Text style={styles.modalSunrise}>Local light arrived around {sunriseFormatted}</Text>
            {hasRisen ? (
              <Text style={styles.modalHint}>Daylight has already reached this place</Text>
            ) : (
              <Text style={styles.modalHint}>
                {hoursToGo > 0
                  ? `Morning still ${hoursToGo} hour${hoursToGo !== 1 ? 's' : ''} away here`
                  : 'Morning is approaching here'}
              </Text>
            )}
            <Pressable style={styles.modalClose} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    position: 'absolute',
    borderRadius: 22,
  },
  labelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  youLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: 'rgba(196, 244, 210, 0.78)',
    textShadowColor: 'rgba(3, 10, 20, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 12,
    padding: 20,
    minWidth: 220,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  modalCity: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 8,
  },
  modalSunrise: {
    fontSize: 15,
    color: Dawn.text.secondary,
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 16,
  },
  modalClose: {
    alignSelf: 'flex-end',
  },
  modalCloseText: {
    fontSize: 14,
    color: Dawn.accent.sunrise,
  },
});
