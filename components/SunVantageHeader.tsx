import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import supabase from '../supabase';
import { Dawn } from '../constants/theme';
import NavigationOverlay from './NavigationOverlay';

const ARROW_ROTATION_DURATION = 180;
const TITLE_TO_TAGLINE = 6;
const TAGLINE_TO_ARROW = 6;
const ARROW_TO_CONTENT = 18;

type Props = {
  showBack?: boolean;
  title?: string;
  subtitle?: string;
  /** Optional tagline shown below the SunVantage title (e.g. on home). Tappable with title to open nav. */
  tagline?: string;
  children?: React.ReactNode;
  /** When true, first menu item is "Today's sunrise"; when false, "Log today's sunrise". Both route to /witness. */
  hasLoggedToday?: boolean;
  /** When true, only show back (← Home), title, subtitle; no SunVantage dropdown. */
  hideMenu?: boolean;
  /** When true with hideMenu, show the large "SunVantage" branding text (no menu trigger). */
  showBranding?: boolean;
  /** When true, show "My City's Sunrises" in the nav panel. */
  showMyCitySunrises?: boolean;
  /** Override bottom margin of the header wrapper (e.g. 0 for tighter layout when scroll content has its own padding). */
  wrapperMarginBottom?: number;
  /** Override back button label (e.g. "Back" when returning to previous screen instead of Home). */
  backLabel?: string;
  /** Override back button action (e.g. router.back() when returning to previous screen). */
  onBackPress?: () => void;
};

export default function SunVantageHeader({
  showBack,
  title,
  subtitle,
  tagline,
  children,
  hasLoggedToday = false,
  hideMenu = false,
  showBranding = false,
  showMyCitySunrises = false,
  wrapperMarginBottom,
  backLabel,
  onBackPress,
}: Props) {
  const router = useRouter();
  const [navVisible, setNavVisible] = useState(false);
  const arrowRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!navVisible) {
      Animated.timing(arrowRotation, {
        toValue: 0,
        duration: ARROW_ROTATION_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [navVisible]);

  const handleHeaderPress = () => {
    Animated.timing(arrowRotation, {
      toValue: 1,
      duration: ARROW_ROTATION_DURATION,
      useNativeDriver: true,
    }).start(() => setNavVisible(true));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/auth' as never);
  };

  const handleBackPress = onBackPress ?? (() => { router.push('/home'); });
  const displayBackLabel = backLabel ?? (hideMenu ? '← Home' : '‹ SunVantage Home');

  const wrapperStyle = wrapperMarginBottom !== undefined ? [styles.wrapper, { marginBottom: wrapperMarginBottom }] : styles.wrapper;

  return (
    <>
      <View style={wrapperStyle}>
        {showBack && (
          <Pressable
            style={({ pressed }) => [styles.backControl, pressed && { opacity: 0.72 }]}
            onPress={handleBackPress}
          >
            <Text style={styles.backControlText}>{displayBackLabel}</Text>
          </Pressable>
        )}
        {!hideMenu && (
          <Pressable
            style={({ pressed }) => [styles.headerBlock, pressed && { opacity: 0.78 }]}
            onPress={handleHeaderPress}
          >
            <View style={styles.headerRow}>
              <Text style={styles.appName}>SunVantage</Text>
              <Text style={styles.headerEmoji}>🧭</Text>
            </View>
            {tagline ? (
              <>
                <Text style={styles.tagline}>{tagline}</Text>
                <Animated.Text
                  style={[
                    styles.arrowIndicator,
                    {
                      transform: [
                        {
                          rotate: arrowRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '90deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  ⌄
                </Animated.Text>
              </>
            ) : null}
          </Pressable>
        )}
        {hideMenu && showBranding ? <Text style={styles.appName}>SunVantage</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>

      <NavigationOverlay
        visible={navVisible}
        onClose={() => setNavVisible(false)}
        hasLoggedToday={hasLoggedToday}
        showMyCitySunrises={showMyCitySunrises}
        onSignOut={handleSignOut}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: ARROW_TO_CONTENT,
  },
  backControl: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backControlText: {
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  headerBlock: {
    alignSelf: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  headerEmoji: {
    fontSize: 20,
    marginLeft: 6,
  },
  tagline: {
    marginTop: TITLE_TO_TAGLINE,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  arrowIndicator: {
    marginTop: TAGLINE_TO_ARROW,
    marginBottom: 0,
    fontSize: 14,
    color: Dawn.text.secondary,
    opacity: 0.8,
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
});
