import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDawn } from '@/hooks/use-dawn';
import type { DawnCard } from '@/data/dawnCards';

type Props = {
  dawnCard?: DawnCard | null;
  hasLoggedToday: boolean;
  city: string | null;
  time: string;
  relativeTimeLabel?: string | null;
  statusLabel?: string | null;
  style?: ViewStyle | ViewStyle[];
  tone?: 'default' | 'context';
  /** Secondary text link (not a button) — e.g. open today’s sunrise when city Explore is hidden. */
  showSeeMorningLink?: boolean;
  onPressSeeMorning?: () => void;
};

const FALLBACK_PRE = 'You are here.';
const FALLBACK_POST = 'You were here.';

export default function SunriseStateCard({
  dawnCard,
  hasLoggedToday,
  city,
  time,
  relativeTimeLabel = null,
  statusLabel = null,
  style,
  tone = 'default',
  showSeeMorningLink = false,
  onPressSeeMorning,
}: Props) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const verb = (dawnCard?.verb || 'WITNESS').toUpperCase();
  const preText = dawnCard?.text || FALLBACK_PRE;
  const postText = dawnCard?.completion || FALLBACK_POST;

  return (
    <View style={[styles.card, tone === 'context' && styles.cardContext, style]}>
      {hasLoggedToday ? (
        <LinearGradient
          colors={['rgba(255,179,71,0.0)', 'rgba(255,179,71,0.11)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.titleRow, tone === 'context' && styles.titleRowContext]}>
        <Text style={styles.sunEmoji}>☀️</Text>
        <Text style={[styles.title, tone === 'context' && styles.titleContext]}>Sunrise today</Text>
      </View>
      {relativeTimeLabel ? <Text style={styles.relativeTime}>{relativeTimeLabel}</Text> : null}
      <Text style={[styles.cityTime, relativeTimeLabel && styles.cityTimeSecondary]}>
        {city || 'Your city'} · {time}
      </Text>
      {statusLabel ? <Text style={styles.statusLabel}>{statusLabel}</Text> : null}
      <Text style={styles.verb}>{verb}</Text>
      {hasLoggedToday ? (
        <Text style={[styles.message, styles.postMessage]}>{postText}</Text>
      ) : (
        <Text style={styles.message}>
          {preText.split('\n').map((line, i, arr) => (
            <Text key={`${line}-${i}`}>
              {line}
              {i < arr.length - 1 ? '\n' : ''}
            </Text>
          ))}
        </Text>
      )}
      {hasLoggedToday && showSeeMorningLink && onPressSeeMorning ? (
        <Pressable
          onPress={onPressSeeMorning}
          style={({ pressed }) => [styles.seeMorningLinkWrap, pressed && styles.seeMorningLinkPressed]}
          accessibilityRole="link"
          accessibilityLabel="See your morning"
        >
          <Text style={styles.seeMorningLinkText}>See your morning →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    card: {
      backgroundColor: Dawn.surface.card,
      borderRadius: 22,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : 'rgba(255, 200, 120, 0.4)',
      overflow: 'hidden',
    },
    cardContext: {
      paddingVertical: 12,
      borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.04)' : 'rgba(255, 200, 120, 0.22)',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 4,
    },
    titleRowContext: {
      marginBottom: 3,
    },
    sunEmoji: {
      fontSize: 18,
      textShadowColor: 'rgba(255, 200, 120, 0.35)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 6,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: Dawn.text.primary,
      textAlign: 'center',
    },
    titleContext: {
      fontSize: 17,
      fontWeight: '500',
    },
    cityTime: {
      fontSize: 13,
      opacity: 0.73,
      color: Dawn.text.secondary,
      textAlign: 'center',
      marginBottom: 0,
    },
    cityTimeSecondary: {
      marginTop: 2,
      opacity: 0.7,
    },
    relativeTime: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '600',
      color: Dawn.text.primary,
      textAlign: 'center',
      marginBottom: 1,
    },
    statusLabel: {
      marginTop: 10,
      marginBottom: -2,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: Dawn.text.secondary,
      opacity: 0.72,
      textAlign: 'center',
    },
    verb: {
      marginTop: 13,
      fontSize: 17.5,
      lineHeight: 22,
      letterSpacing: 3.2,
      color: Dawn.text.primary,
      textAlign: 'center',
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    message: {
      marginTop: 7,
      fontSize: 13.5,
      lineHeight: 20,
      color: Dawn.text.secondary,
      opacity: 0.85,
      textAlign: 'center',
    },
    postMessage: {
      opacity: 0.9,
      fontWeight: '500',
    },
    seeMorningLinkWrap: {
      marginTop: 14,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    seeMorningLinkPressed: {
      opacity: 0.72,
    },
    seeMorningLinkText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
      color: Dawn.accent.sunrise,
      opacity: 0.82,
      textAlign: 'center',
    },
  });
}
