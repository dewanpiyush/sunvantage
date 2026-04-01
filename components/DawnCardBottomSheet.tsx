import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Dimensions, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type DawnCardBottomSheetProps = {
  verb?: string;
  text?: string;
  footerHint?: string;
  /** Echo mode: auto-dismiss without blocking touches. */
  autoDismiss?: boolean;
  /** Echo mode: total visible time (ms). */
  duration?: number;
  /**
   * Approx height of the sheet relative to screen height.
   * Defaults to ~60% as requested.
   */
  heightRatio?: number;
  /**
   * Called after the dismiss animation completes (fade+slide).
   * Parent should unmount the component after this.
   */
  onDismissed: () => void | Promise<void>;
};

const DEFAULT_VERB = 'RESET';
const DEFAULT_TEXT = 'The sun does not carry yesterday.\nNeither do you have to.';
const DEFAULT_FOOTER_HINT = 'tap anywhere';
const DEFAULT_ECHO_DURATION_MS = 2500;

const ANIM_IN_MS = 500;
const ANIM_OUT_MS = 320;
const ECHO_FADE_IN_MS = 250;
const ECHO_FADE_OUT_MS = 900;
const ECHO_TAP_FADE_OUT_MS = 260;
/** Echo card: compact “moment” — max ~30% screen, min for readability. */
const ECHO_HEIGHT_RATIO_CAP = 0.3;
const ECHO_MIN_HEIGHT = 240;
const DISMISS_DRAG_THRESHOLD_PX_FLOOR = 90;
const TAP_DY_TOLERANCE_PX = 6;
const TAP_VELOCITY_TOLERANCE = 0.55;

export default function DawnCardBottomSheet({
  verb = DEFAULT_VERB,
  text = DEFAULT_TEXT,
  footerHint = DEFAULT_FOOTER_HINT,
  autoDismiss = false,
  duration = DEFAULT_ECHO_DURATION_MS,
  heightRatio = 0.6,
  onDismissed,
}: DawnCardBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get('window').height;
  const sheetHeight = useMemo(() => Math.round(windowH * heightRatio), [heightRatio]);
  const echoMaxHeight = Math.round(windowH * ECHO_HEIGHT_RATIO_CAP);

  const isIOS = Platform.OS === 'ios';
  const translateY = useSharedValue(sheetHeight);
  const sheetOpacity = useSharedValue(autoDismiss ? 0 : 1);
  /** Echo only: gentle scale-in (0.96 → 1); unused in modal path. */
  const echoScale = useSharedValue(0.96);
  // iOS only: fade the dim overlay in/out.
  // On Android, dim overlay remains constant (no opacity animation).
  const overlayOpacity = useSharedValue(isIOS ? 0 : 1);

  const isClosingRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const echoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [reduceMotionReady, setReduceMotionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const v = await AccessibilityInfo.isReduceMotionEnabled?.();
        if (!mounted) return;
        setReduceMotionEnabled(Boolean(v));
      } catch {
        // ignore
      } finally {
        if (!mounted) return;
        setReduceMotionReady(true);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const animateIn = useCallback(() => {
    if (autoDismiss) {
      translateY.value = 0;
      if (reduceMotionEnabled) {
        sheetOpacity.value = 1;
        echoScale.value = 1;
        return;
      }
      sheetOpacity.value = 0;
      echoScale.value = 0.96;
      sheetOpacity.value = withTiming(1, {
        duration: ECHO_FADE_IN_MS,
        easing: Easing.out(Easing.quad),
      });
      echoScale.value = withTiming(1, {
        duration: ECHO_FADE_IN_MS,
        easing: Easing.out(Easing.quad),
      });
      return;
    }

    // Always start from bottom.
    translateY.value = sheetHeight;
    if (reduceMotionEnabled) {
      translateY.value = 0;
      if (isIOS) overlayOpacity.value = 1;
      return;
    }

    translateY.value = withTiming(0, {
      duration: ANIM_IN_MS,
      easing: Easing.out(Easing.quad),
    });

    if (isIOS) {
      overlayOpacity.value = withTiming(1, {
        duration: ANIM_IN_MS,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [autoDismiss, echoScale, isIOS, overlayOpacity, reduceMotionEnabled, sheetHeight, sheetOpacity, translateY]);

  // Start animations on mount once reduce-motion preference is known.
  useEffect(() => {
    if (!reduceMotionReady) return;
    overlayOpacity.value = isIOS ? 0 : 1;
    if (!autoDismiss) sheetOpacity.value = 1;
    animateIn();
  }, [animateIn, autoDismiss, isIOS, overlayOpacity, reduceMotionReady, sheetOpacity]);

  useEffect(() => {
    if (!autoDismiss) return;
    if (!reduceMotionReady) return;

    const total = Math.max(300, duration);
    const hold = Math.max(0, total - ECHO_FADE_IN_MS - ECHO_FADE_OUT_MS);

    if (echoTimerRef.current) clearTimeout(echoTimerRef.current);
    echoTimerRef.current = setTimeout(() => {
      if (reduceMotionEnabled) {
        void Promise.resolve(onDismissed());
        return;
      }
      echoScale.value = withTiming(0.96, {
        duration: ECHO_FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
      });
      sheetOpacity.value = withTiming(0, {
        duration: ECHO_FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
      });
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => void Promise.resolve(onDismissed()), ECHO_FADE_OUT_MS + 20);
    }, ECHO_FADE_IN_MS + hold);

    return () => {
      if (echoTimerRef.current) clearTimeout(echoTimerRef.current);
    };
  }, [autoDismiss, duration, echoScale, onDismissed, reduceMotionEnabled, reduceMotionReady, sheetOpacity]);

  const closeWithAnimation = useCallback(() => {
    if (autoDismiss) return;
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (reduceMotionEnabled) {
      translateY.value = sheetHeight;
      if (isIOS) overlayOpacity.value = 0;
      void Promise.resolve(onDismissed());
      return;
    }

    translateY.value = withTiming(sheetHeight, {
      duration: ANIM_OUT_MS,
      easing: Easing.out(Easing.quad),
    });

    if (isIOS) {
      overlayOpacity.value = withTiming(0, {
        duration: ANIM_OUT_MS,
        easing: Easing.out(Easing.quad),
      });
    }

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      void Promise.resolve(onDismissed());
      isClosingRef.current = false;
    }, ANIM_OUT_MS);
  }, [autoDismiss, isIOS, onDismissed, overlayOpacity, reduceMotionEnabled, sheetHeight, translateY]);

  const panResponder = useMemo(() => {
    if (autoDismiss) {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
      });
    }
    const dragThreshold = Math.max(DISMISS_DRAG_THRESHOLD_PX_FLOOR, Math.round(sheetHeight * 0.2));
    return PanResponder.create({
      // We want tap + swipe anywhere inside the sheet to dismiss.
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        const dy = Math.max(0, gestureState.dy);
        translateY.value = dy;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const dy = Math.max(0, gestureState.dy);
        const vy = gestureState.vy;
        const isTap = dy < TAP_DY_TOLERANCE_PX && Math.abs(vy) < TAP_VELOCITY_TOLERANCE;

        if (dy >= dragThreshold || vy >= 1.1 || isTap) {
          closeWithAnimation();
          return;
        }

        // Return to the resting position.
        if (reduceMotionEnabled) {
          translateY.value = 0;
        } else {
          translateY.value = withTiming(0, {
            duration: 180,
            easing: Easing.out(Easing.quad),
          });
        }
      },
    });
  }, [autoDismiss, closeWithAnimation, reduceMotionEnabled, sheetHeight, translateY]);

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: sheetOpacity.value,
    };
  }, [sheetOpacity, translateY]);

  const echoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ scale: echoScale.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: overlayOpacity.value,
    };
  }, [overlayOpacity]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (echoTimerRef.current) clearTimeout(echoTimerRef.current);
    };
  }, []);

  const dismissEchoFast = useCallback(() => {
    if (!autoDismiss) return;
    if (echoTimerRef.current) clearTimeout(echoTimerRef.current);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    if (reduceMotionEnabled) {
      void Promise.resolve(onDismissed());
      return;
    }

    echoScale.value = withTiming(0.96, {
      duration: ECHO_TAP_FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
    });
    sheetOpacity.value = withTiming(0, {
      duration: ECHO_TAP_FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
    });
    dismissTimerRef.current = setTimeout(() => void Promise.resolve(onDismissed()), ECHO_TAP_FADE_OUT_MS + 20);
  }, [autoDismiss, onDismissed, reduceMotionEnabled, echoScale, sheetOpacity]);

  if (autoDismiss) {
    // Echo mode: auto-dismiss with tap-anywhere fallback.
    return (
      <View style={styles.echoRoot} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissEchoFast} />
        <Animated.View
          style={[
            styles.echoSheet,
            {
              maxHeight: echoMaxHeight,
              minHeight: ECHO_MIN_HEIGHT,
              marginBottom: Math.max(16, insets.bottom + 8),
            },
            echoAnimatedStyle,
          ]}
        >
          <LinearGradient
            // Halo, not a full sheet: softer stops, lighter anchor.
            colors={[
              'rgba(28, 42, 74, 0.0)',
              'rgba(52, 54, 118, 0.22)',
              'rgba(96, 72, 128, 0.32)',
              'rgba(110, 78, 92, 0.36)',
              'rgba(28, 36, 60, 0.52)',
            ]}
            locations={[0, 0.28, 0.5, 0.72, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheetGradient}
          />

          <View style={styles.echoContent}>
            <View style={styles.echoTextBlock}>
              <Text style={styles.echoVerb} accessibilityRole="text">
                {verb.toUpperCase()}
              </Text>
              <Text style={styles.echoPromptText} accessibilityRole="text">
                {text}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation}>
          <Animated.View style={[styles.backdrop, overlayAnimatedStyle]} />
        </Pressable>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: Math.max(16, insets.bottom),
            },
            sheetAnimatedStyle,
          ]}
        >
          <LinearGradient
            // Top: strong dim (recedes header / cards behind sheet). Mid: indigo → purple identity.
            // Bottom: slightly lighter anchor so copy zone breathes — atmospheric, not a flat scrim.
            colors={[
              'rgba(20, 28, 50, 0.80)', // top: strong dim
              'rgba(36, 42, 92, 0.72)', // deeper indigo
              'rgba(72, 58, 120, 0.68)', // purple bridge (softened)
              'rgba(28, 42, 74, 0.78)', // lifted deep blue
              'rgba(20, 28, 50, 0.88)', // bottom anchor
            ]}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheetGradient}
          />

          <View
            style={[
              styles.content,
              {
                // Keep padding in a stable ritual zone (60–80px) while biasing upward.
                // Move entire block upward by ~25% from current.
                paddingBottom: Math.min(110, Math.max(60, Math.round(sheetHeight * 0.275))),
              },
            ]}
          >
            <View style={styles.textBlock}>
              <Text style={styles.verb} accessibilityRole="text">
                {verb.toUpperCase()}
              </Text>

              <Text style={styles.promptText} accessibilityRole="text">
                {text}
              </Text>

              {autoDismiss ? null : (
                <Text style={styles.footerHint} accessibilityRole="text">
                  {footerHint}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  echoRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  echoSheet: {
    marginHorizontal: 20,
    alignSelf: 'stretch',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 28, 50, 0.22)',
  },
  echoContent: {
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  echoTextBlock: {
    width: '80%',
    alignItems: 'center',
  },
  echoVerb: {
    fontSize: 17.5,
    lineHeight: 21,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  echoPromptText: {
    marginTop: 14,
    fontSize: 14.5,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // Tinted dim only (no pure black) — matches dawn palette, softens detail behind sheet.
    backgroundColor: 'rgba(20, 28, 50, 0.58)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Subtle base so the transparent top doesn't look "cut out".
    backgroundColor: 'rgba(20,28,50,0.35)',
  },
  sheetGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
    // paddingBottom is set dynamically in render to bias the block upward.
  },
  textBlock: {
    width: '80%',
    alignItems: 'center',
  },
  verb: {
    fontSize: 19.5,
    lineHeight: 22,
    letterSpacing: 0.65, // ~4-5% feel
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    // RN small-caps support varies; uppercase + letter spacing is our fallback.
  },
  promptText: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  footerHint: {
    marginTop: 18,
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

