/**
 * Soft glow for a city where SunVantage users welcomed the morning today.
 * Size scales gently with log count. Tappable for a quiet detail modal.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Pressable, Modal, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import SunCalc from 'suncalc';
import { format } from 'date-fns';
import { useWindowDimensions } from 'react-native';
import { geoToScreen } from '@/lib/geoToScreen';
import { Dawn } from '@/constants/theme';

const WITNESS_FILL = '#D4B87A';
const MIN_RADIUS = 2;
const RADIUS_PER_LOG = 0.45;
const MAX_RADIUS = 8;
const GLOW_THRESHOLD = 8;
const GLOW_EXTRA_RADIUS = 5;
const GLOW_OPACITY = 0.28;
const PULSE_DURATION_MS = 4000;
const PULSE_SCALE_MAX = 1.04;
const DOT_BOX_SIZE = 36;

export type CityLog = {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  logs: number;
};

type Props = {
  city: CityLog;
  now: Date;
  width?: number;
  height?: number;
};

function radiusForLogs(logs: number): number {
  const r = MIN_RADIUS + logs * RADIUS_PER_LOG;
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
}

export default function CityDot({ city, now, width: propWidth, height: propHeight }: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const width = propWidth ?? winWidth;
  const height = propHeight ?? winHeight;
  const [modalVisible, setModalVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const xy = useMemo(
    () => geoToScreen(city.lat, city.lng, width, height),
    [city.lat, city.lng, width, height]
  );

  const sunriseTime = useMemo(() => {
    const times = SunCalc.getTimes(now, city.lat, city.lng);
    return times.sunrise;
  }, [now.getTime(), city.lat, city.lng]);

  const r = radiusForLogs(city.logs);
  const hitSlop = Math.max(24, r * 3);
  const showGlow = city.logs > GLOW_THRESHOLD;
  const center = DOT_BOX_SIZE / 2;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: PULSE_SCALE_MAX,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) pulse();
      });
    };
    pulse();
  }, [scaleAnim]);

  if (xy == null) return null;

  return (
    <>
      <Pressable
        style={[
          styles.hitArea,
          {
            left: xy[0] - hitSlop,
            top: xy[1] - hitSlop,
            width: hitSlop * 2,
            height: hitSlop * 2,
          },
        ]}
        onPress={() => setModalVisible(true)}
      />
      <View
        style={[
          styles.dotWrapper,
          {
            left: xy[0] - center,
            top: xy[1] - center,
            width: DOT_BOX_SIZE,
            height: DOT_BOX_SIZE,
          },
        ]}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            styles.dotAnimated,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Svg width={DOT_BOX_SIZE} height={DOT_BOX_SIZE}>
            {showGlow && (
              <Circle
                cx={center}
                cy={center}
                r={r + GLOW_EXTRA_RADIUS}
                fill={WITNESS_FILL}
                opacity={GLOW_OPACITY}
              />
            )}
            <Circle cx={center} cy={center} r={r} fill={WITNESS_FILL} opacity={0.92} />
          </Svg>
        </Animated.View>
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
            <Text style={styles.modalWitnesses}>
              {city.logs} morning{city.logs !== 1 ? 's' : ''} welcomed here today
            </Text>
            <Text style={styles.modalSunrise}>Local light arrived at {format(sunriseTime, 'h:mm a')}</Text>
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
    borderRadius: 999,
  },
  dotWrapper: {
    position: 'absolute',
  },
  dotAnimated: {
    width: DOT_BOX_SIZE,
    height: DOT_BOX_SIZE,
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
  modalWitnesses: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 6,
  },
  modalSunrise: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 14,
  },
  modalClose: {
    alignSelf: 'flex-end',
  },
  modalCloseText: {
    fontSize: 14,
    color: Dawn.accent.sunrise,
  },
});
