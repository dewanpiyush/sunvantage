/**
 * Compact inline card to acknowledge a newly earned ritual marker.
 * Used only: (1) above memory card after logging on Witness/Vantage, (2) below streak on Home on next open.
 * Dismissible only by tap or ✕; "View markers" does not dismiss. Once dismissed, never shown again for that badge.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDawn } from '@/hooks/use-dawn';

export type RitualRevealCardProps = {
  visible: boolean;
  onDismiss: () => void;
  onViewMarkers?: () => void;
  /** CTA should appear only in just-earned context, not on later revisit. */
  showCta?: boolean;
  icon?: React.ReactNode;
  title: string;
  /** Concrete explanation, e.g. "You logged two reflections." */
  description: string;
  ctaText?: string;
};

const ENTER_DURATION = 350;
const EXIT_DURATION = 260;
const SLIDE_DISTANCE = 10;

export default function RitualRevealCard({
  visible,
  onDismiss,
  onViewMarkers,
  showCta = true,
  icon,
  title,
  description,
  ctaText = 'View markers',
}: RitualRevealCardProps) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isExiting = useRef(false);

  useEffect(() => {
    if (!visible) return;
    isExiting.current = false;
    translateY.setValue(SLIDE_DISTANCE);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, opacity]);

  const handleDismiss = () => {
    if (isExiting.current) return;
    isExiting.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -4,
        duration: EXIT_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const resolvedDescription = description.replace(/^You welcomed/i, "You've welcomed");

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${resolvedDescription}.${showCta && onViewMarkers ? ` ${ctaText}.` : ''} Tap to dismiss.`}
      >
        <View style={styles.inner}>
          <View style={styles.topRow}>
            <View style={styles.titleBlock}>
              {icon != null ? (
                <View style={styles.iconWrap}>{typeof icon === 'string' ? <Text style={styles.iconEmoji}>{icon}</Text> : icon}</View>
              ) : (
                <View style={styles.iconWrap}>
                  <Text style={styles.iconEmoji}>✦</Text>
                </View>
              )}
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.dismissBtn, pressed && styles.dismissBtnPressed]}
              onPress={handleDismiss}
              hitSlop={10}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={16} color={Dawn.text.secondary} />
            </Pressable>
          </View>
          <Text style={styles.description}>{resolvedDescription}</Text>
          {showCta && onViewMarkers ? (
            <Pressable style={({ pressed }) => [styles.ctaLink, pressed && styles.ctaLinkPressed]} onPress={onViewMarkers}>
              <Text style={styles.ctaLinkText}>{ctaText} →</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  card: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardPressed: {
    opacity: 0.98,
  },
  inner: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 15,
    margin: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  dismissBtnPressed: {
    opacity: 0.5,
  },
  iconWrap: {},
  iconEmoji: {
    fontSize: 18,
    opacity: 0.8,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Dawn.text.primary,
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: Dawn.text.secondary,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 0,
  },
  ctaLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 4,
  },
  ctaLinkPressed: {
    opacity: 0.8,
  },
  ctaLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.accent.sunrise,
  },
  });
}
