import React, { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AUTO_DISMISS_MS = 2000;
const FADE_IN_MS = 280;
const FADE_OUT_MS = 360;

export type MorningUnfoldingPauseProps = {
  visible: boolean;
  onDismissed: () => void;
};

/**
 * Ceremonial pause when sunrise logging is still too early — not an error dialog.
 */
export default function MorningUnfoldingPause({ visible, onDismissed }: MorningUnfoldingPauseProps) {
  const insets = useSafeAreaInsets();
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetScale = useRef(new Animated.Value(0.96)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const runDismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetScale, {
        toValue: 0.98,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        closingRef.current = false;
        onDismissed();
      }
    });
  }, [backdropOpacity, onDismissed, sheetOpacity, sheetScale]);

  useEffect(() => {
    if (!visible) {
      sheetOpacity.setValue(0);
      sheetScale.setValue(0.96);
      backdropOpacity.setValue(0);
      closingRef.current = false;
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      return;
    }

    closingRef.current = false;
    sheetOpacity.setValue(0);
    sheetScale.setValue(0.96);
    backdropOpacity.setValue(0);

    let reduceMotion = false;
    const start = () => {
      if (reduceMotion) {
        sheetOpacity.setValue(1);
        sheetScale.setValue(1);
        backdropOpacity.setValue(1);
      } else {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(sheetOpacity, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(sheetScale, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }

      dismissTimerRef.current = setTimeout(runDismiss, AUTO_DISMISS_MS);
    };

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        reduceMotion = Boolean(v);
        start();
      })
      .catch(() => start());

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible, backdropOpacity, runDismiss, sheetOpacity, sheetScale]);

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={runDismiss}>
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
        <Animated.View
          style={[
            styles.sheetWrap,
            {
              marginBottom: Math.max(20, insets.bottom + 12),
              opacity: sheetOpacity,
              transform: [{ scale: sheetScale }],
            },
          ]}
        >
          <View style={styles.glowHalo} pointerEvents="none" />
          <LinearGradient
            colors={[
              'rgba(255, 200, 140, 0.14)',
              'rgba(120, 88, 160, 0.20)',
              'rgba(32, 44, 78, 0.72)',
            ]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheetGradient}
          />
          <View style={styles.content}>
            <Text style={styles.title} accessibilityRole="text">
              The morning is still unfolding.
            </Text>
            <Text style={styles.subtitle} accessibilityRole="text">
              Just wait a few more minutes.
            </Text>
            <Pressable
              onPress={runDismiss}
              style={({ pressed }) => [styles.okayBtn, pressed && styles.okayBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Okay"
            >
              <Text style={styles.okayBtnText}>Okay</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 28, 48, 0.28)',
  },
  sheetWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(24, 34, 58, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 210, 160, 0.22)',
    shadowColor: 'rgba(255, 180, 100, 0.45)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  glowHalo: {
    position: 'absolute',
    top: -40,
    left: '12%',
    right: '12%',
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 190, 120, 0.18)',
  },
  sheetGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    color: 'rgba(255, 248, 240, 0.94)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '400',
    color: 'rgba(255, 248, 240, 0.72)',
    textAlign: 'center',
  },
  okayBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 210, 160, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 210, 160, 0.28)',
  },
  okayBtnPressed: {
    opacity: 0.85,
  },
  okayBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 248, 240, 0.88)',
    letterSpacing: 0.3,
  },
});
