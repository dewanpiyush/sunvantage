import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';
import VantageHuntDawnCanvas from '@/components/VantageHuntDawnCanvas';
import {
  formatHuntTransitCountdown,
  shouldShowHuntCountdown,
  type VantageHuntSession,
} from '@/lib/vantageHunt';

type Props = {
  minutesToSunrise: number | null;
  sunriseLabel: string;
  city: string | null;
  session: VantageHuntSession | null;
  locationBusy: boolean;
  arrivalFinding: boolean;
  isMorningLight?: boolean;
  onPickPredawn: () => void;
  onArrived: () => void;
};

export default function VantageHuntTransit({
  minutesToSunrise,
  sunriseLabel,
  city,
  session,
  locationBusy,
  arrivalFinding,
  isMorningLight = false,
  onPickPredawn,
  onArrived,
}: Props) {
  const Dawn = useDawn();
  const showCountdown = shouldShowHuntCountdown(minutesToSunrise);
  const countdownLine = formatHuntTransitCountdown(minutesToSunrise);
  const placeLine = [city?.trim() || null, sunriseLabel].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <View style={styles.timingBlock}>
        {showCountdown ? (
          <Text style={[styles.countdownLine, { color: Dawn.text.secondary }]}>{countdownLine}</Text>
        ) : null}
        {placeLine ? (
          <Text style={[styles.placeLine, { color: Dawn.text.secondary }]}>{placeLine}</Text>
        ) : null}
      </View>

      <View style={styles.center}>
        <VantageHuntDawnCanvas
          predawnImageUri={session?.predawnImageUri}
          predawnCapturedAt={session?.predawnImageCapturedAt}
          isMorningLight={isMorningLight}
        />
      </View>

      <View style={styles.lower}>
        <Pressable
          style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
          onPress={onPickPredawn}
          disabled={locationBusy || arrivalFinding}
        >
          <Text style={[styles.secondaryActionText, { color: Dawn.accent.sunrise }]}>
            Add a pre-dawn moment
          </Text>
          <Text style={[styles.secondaryHint, { color: Dawn.text.secondary }]}>Optional</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: Dawn.accent.sunrise },
            pressed && styles.pressed,
          ]}
          onPress={onArrived}
          disabled={locationBusy || arrivalFinding}
        >
          {locationBusy || arrivalFinding ? (
            <ActivityIndicator color={Dawn.accent.sunriseOn} />
          ) : (
            <Text style={[styles.primaryCtaText, { color: Dawn.accent.sunriseOn }]}>
              I am at the vantage
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 480,
    paddingTop: 4,
  },
  timingBlock: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  countdownLine: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.15,
    opacity: 0.88,
    textAlign: 'center',
  },
  placeLine: {
    fontSize: 13,
    opacity: 0.72,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lower: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
    alignItems: 'center',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryHint: {
    fontSize: 11,
    opacity: 0.62,
    marginTop: 2,
  },
  primaryCta: {
    paddingVertical: Platform.OS === 'android' ? 13 : 14,
    paddingHorizontal: 36,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
});
