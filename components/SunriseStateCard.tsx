import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDawn } from '@/hooks/use-dawn';
import type { DawnCard } from '@/data/dawnCards';

type Props = {
  dawnCard?: DawnCard | null;
  hasLoggedToday: boolean;
  city: string | null;
  time: string;
  style?: object;
};

const FALLBACK_PRE = 'You are here.';
const FALLBACK_POST = 'You were here.';

export default function SunriseStateCard({ dawnCard, hasLoggedToday, city, time, style }: Props) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const verb = (dawnCard?.verb || 'WITNESS').toUpperCase();
  const preText = dawnCard?.text || FALLBACK_PRE;
  const postText = dawnCard?.completion || FALLBACK_POST;

  return (
    <View style={[styles.card, style]}>
      {hasLoggedToday ? (
        <LinearGradient
          colors={['rgba(255,179,71,0.0)', 'rgba(255,179,71,0.11)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.titleRow}>
        <Text style={styles.sunEmoji}>☀️</Text>
        <Text style={styles.title}>Sunrise today</Text>
      </View>
      <Text style={styles.cityTime}>
        {city || 'Your city'}. {time}.
      </Text>
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 4,
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
    cityTime: {
      fontSize: 13,
      opacity: 0.73,
      color: Dawn.text.secondary,
      textAlign: 'center',
      marginBottom: 0,
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
  });
}
