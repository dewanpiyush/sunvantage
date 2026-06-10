import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useDawn } from '@/hooks/use-dawn';
import { formatPredawnCapturedTime } from '@/lib/vantageHunt';

type Props = {
  predawnImageUri?: string | null;
  predawnCapturedAt?: string | null;
  isMorningLight?: boolean;
};

export default function VantageHuntDawnCanvas({
  predawnImageUri,
  predawnCapturedAt,
  isMorningLight = false,
}: Props) {
  const Dawn = useDawn();
  const glow = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 5200, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 5200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow, drift]);

  const capturedLabel = formatPredawnCapturedTime(predawnCapturedAt);

  if (predawnImageUri) {
    return (
      <View style={styles.imageWrap}>
        <View
          style={[
            styles.imageCard,
            {
              borderColor: isMorningLight ? 'rgba(245, 166, 35, 0.28)' : 'rgba(255, 200, 120, 0.22)',
              shadowColor: Dawn.accent.sunrise,
            },
          ]}
        >
          <Image source={{ uri: predawnImageUri }} style={styles.image} contentFit="cover" />
        </View>
        <Text style={[styles.caption, { color: Dawn.text.primary }]}>Before the light.</Text>
        {capturedLabel ? (
          <Text style={[styles.timestamp, { color: Dawn.text.secondary }]}>Captured {capturedLabel}</Text>
        ) : null}
      </View>
    );
  }

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.62] });
  const horizonShift = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });

  return (
    <View style={styles.placeholderWrap}>
      <Animated.View
        style={[
          styles.placeholderOuter,
          {
            opacity: glowOpacity,
            transform: [{ translateY: horizonShift }],
          },
        ]}
      >
        <LinearGradient
          colors={
            isMorningLight
              ? ['rgba(255, 248, 235, 0.15)', 'rgba(245, 166, 35, 0.22)', 'rgba(180, 200, 230, 0.12)']
              : ['rgba(16, 42, 67, 0.2)', 'rgba(255, 179, 71, 0.18)', 'rgba(36, 63, 99, 0.35)']
          }
          start={{ x: 0.15, y: 1 }}
          end={{ x: 0.85, y: 0 }}
          style={styles.placeholderGradient}
        />
        <LinearGradient
          colors={['rgba(255, 200, 120, 0)', 'rgba(255, 200, 120, 0.14)', 'rgba(255, 200, 120, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.horizonGlow}
        />
      </Animated.View>
      <Text style={[styles.ambientLine, { color: Dawn.text.secondary }]}>
        You are moving toward the light.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    alignItems: 'center',
    width: '100%',
  },
  imageCard: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 4 / 5,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  caption: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  timestamp: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  placeholderWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  placeholderOuter: {
    width: '100%',
    maxWidth: 320,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
  },
  placeholderGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  horizonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    height: 2,
  },
  ambientLine: {
    marginTop: 20,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.72,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
