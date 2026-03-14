/**
 * User's city as a white dot on the map. Tappable to show sunrise time modal.
 */

import React, { useMemo, useState } from 'react';
import { View, Pressable, Modal, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import SunCalc from 'suncalc';
import { format } from 'date-fns';
import { useWindowDimensions } from 'react-native';
import { geoToScreen } from '@/lib/geoToScreen';
import { Dawn } from '@/constants/theme';

const USER_DOT_INNER_RADIUS = 3;
const USER_DOT_RING_RADIUS = 4;
const USER_DOT_RING_WIDTH = 2;
const USER_DOT_FILL = '#FFFFFF';
const USER_DOT_RING_COLOR = '#F4C95D';

export type UserCity = {
  city: string;
  lat: number;
  lng: number;
};

type Props = {
  city: UserCity;
  now: Date;
};

export default function UserCityDot({ city, now }: Props) {
  const { width, height } = useWindowDimensions();
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
        style={[styles.hitArea, { left: xy[0] - 20, top: xy[1] - 20, width: 40, height: 40 }]}
        onPress={() => setModalVisible(true)}
      />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        {/* White core */}
        <Circle cx={xy[0]} cy={xy[1]} r={USER_DOT_INNER_RADIUS} fill={USER_DOT_FILL} />
        {/* Gold ring */}
        <Circle
          cx={xy[0]}
          cy={xy[1]}
          r={USER_DOT_RING_RADIUS}
          fill="none"
          stroke={USER_DOT_RING_COLOR}
          strokeWidth={USER_DOT_RING_WIDTH}
        />
      </Svg>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalCity}>{city.city}</Text>
            <Text style={styles.modalSunrise}>Sunrise: {sunriseFormatted}</Text>
            {hasRisen ? (
              <Text style={styles.modalSub}>Sun has risen 🌅</Text>
            ) : (
              <Text style={styles.modalSub}>
                {hoursToGo > 0 ? `${hoursToGo} hour${hoursToGo !== 1 ? 's' : ''} to go` : 'Less than an hour to go'}
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
    borderRadius: 20,
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
    marginBottom: 8,
  },
  modalSunrise: {
    fontSize: 15,
    color: Dawn.text.secondary,
    marginBottom: 4,
  },
  modalSub: {
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
