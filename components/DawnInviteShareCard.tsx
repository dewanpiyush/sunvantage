/**
 * DawnInviteShareCard — Reusable share card for dawn invitations.
 * Dawn gradient, clear hierarchy, shareable visual artifact (screenshot-friendly).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export const CARD_HEIGHT = 330;

// Deep blue card: #0B2340 → #173C63
const GRADIENT_TOP = '#0B2340';
const GRADIENT_BOTTOM = '#173C63';
const SUNRISE = '#F5A623';
const SUNRISE_ON = '#0E223D';
const TEXT_PRIMARY = 'rgba(255,255,255,0.92)';
const TEXT_SECONDARY = 'rgba(231,238,247,0.78)';

export type DawnInviteShareCardProps = {
  city: string;
  sunriseTimeFormatted: string;
  onShare?: () => void;
  onDismiss?: () => void;
  /** When true, show × and [ Share invitation ] inside card (modal use). */
  interactive?: boolean;
};

export default function DawnInviteShareCard({
  city,
  sunriseTimeFormatted,
  onShare,
  onDismiss,
  interactive = false,
}: DawnInviteShareCardProps) {
  const displayCity = city?.trim() || 'Your city';
  const displayTime = sunriseTimeFormatted?.trim() || '—';

  return (
    <View style={styles.card} collapsable={false}>
      {/* Deep blue gradient #0B2340 → #173C63 */}
      <View style={styles.gradientBase} />
      <View style={styles.gradientBottom} />

      {interactive && onDismiss ? (
        <Pressable
          style={styles.dismissHitArea}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.dismissChar}>×</Text>
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <Text style={styles.title}>
          Tomorrow{"'"}s sunrise in {displayCity}
        </Text>

        <View style={styles.timeBlock}>
          <Text style={styles.sunIcon}>☀️</Text>
          <Text style={styles.time}>{displayTime}</Text>
        </View>

        <Text style={styles.copy}>
          I{"'"}ll be there at dawn.{'\n'}
          Join me in greeting the first light.
        </Text>

        {interactive && onShare ? (
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={onShare}
          >
            <Text style={styles.ctaText}>Share invitation</Text>
          </Pressable>
        ) : null}

        <Text style={styles.brand}>SunVantage</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRADIENT_TOP,
  },
  gradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    backgroundColor: GRADIENT_BOTTOM,
  },
  dismissHitArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dismissChar: {
    fontSize: 28,
    color: TEXT_SECONDARY,
    fontWeight: '300',
    lineHeight: 32,
  },
  content: {
    flex: 1,
    paddingTop: 44,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  timeBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sunIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  time: {
    fontSize: 32,
    fontWeight: '700',
    color: SUNRISE,
    textAlign: 'center',
  },
  copy: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  cta: {
    height: 40,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: SUNRISE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    color: SUNRISE_ON,
  },
  brand: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    letterSpacing: 0.5,
    opacity: 0.9,
  },
});
