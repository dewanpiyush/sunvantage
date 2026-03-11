import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import supabase from '../supabase';
import { getRitualState } from '../lib/ritualState';
import { Dawn } from '../constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [subheading, setSubheading] = useState('See the day differently.');
  const [ctaLabel, setCtaLabel] = useState('Begin today');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const user = session?.user ?? null;
      if (!user?.id) {
        const state = getRitualState(null, 0);
        setSubheading(state.subheading);
        setCtaLabel(state.cta);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const streak = typeof profile?.current_streak === 'number' ? profile.current_streak : 0;
      const state = getRitualState(user, streak);
      setSubheading(state.subheading);
      setCtaLabel(state.cta);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleBegin = () => {
    router.push('/auth');
  };

  const handlePressIn = () => {
    Animated.timing(buttonScale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(buttonScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.horizonGlow} pointerEvents="none" />

      <View style={styles.content}>
        <Text style={styles.appName}>SunVantage</Text>
        <Text style={styles.tagline}>{subheading}</Text>
        <Animated.View style={[styles.buttonWrap, { transform: [{ scale: buttonScale }] }]}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleBegin}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.92}
          >
            <Text style={styles.buttonText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 48,
  },
  gradientTop: {
    ...StyleSheet.absoluteFillObject,
    height: '50%',
    backgroundColor: Dawn.background.primary,
  },
  horizonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '26%',
    height: 4,
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: '12.5%',
  },
  appName: {
    fontSize: 36,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: Dawn.text.secondary,
    maxWidth: 280,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: 36,
    alignSelf: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: Dawn.background.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
    letterSpacing: 0.3,
  },
});
