import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';

type Props = {
  onPress: () => void;
  /** You tab: lighter relational strip, not a full feature card. */
  variant?: 'default' | 'compact';
};

export default function DawnInvitationNudgeCard({ onPress, variant = 'default' }: Props) {
  const Dawn = useDawn();
  const isCompact = variant === 'compact';
  const styles = React.useMemo(() => makeStyles(Dawn, isCompact), [Dawn, isCompact]);

  if (isCompact) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.compactTitle}>✨ Dawn Invitation</Text>
        <Text style={styles.compactDescription}>
          Invite someone to greet tomorrow's sunrise with you.
        </Text>
        <Pressable style={({ pressed }) => [styles.compactCta, pressed && styles.ctaPressed]} onPress={onPress}>
          <Text style={styles.compactCtaText}>Send invitation</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.glow} pointerEvents="none" />
        <View style={styles.inner}>
          <View style={styles.titleBlock}>
            <Text style={styles.iconEmoji}>🌅</Text>
            <Text style={styles.titleEmoji}>✨</Text>
            <Text style={styles.title}>Dawn Invitation</Text>
          </View>

          <Text style={styles.description}>Welcome the sunrise together.</Text>

          <Pressable style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]} onPress={onPress}>
            <Text style={styles.ctaText}>Send invitation</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>, isCompact: boolean) {
  return StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: isCompact ? 0 : 16,
    marginBottom: isCompact ? 0 : 16,
    paddingVertical: isCompact ? 6 : 0,
    paddingHorizontal: isCompact ? 2 : 0,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Dawn.text.primary,
    opacity: 0.9,
    marginBottom: 6,
  },
  compactDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: Dawn.text.secondary,
    opacity: 0.82,
    marginBottom: 10,
  },
  compactCta: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 179, 71, 0.22)',
    backgroundColor: 'transparent',
  },
  compactCtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Dawn.accent.sunrise,
    opacity: 0.78,
  },
  card: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    /** Softer than full sunrise outline — optional layer, not core flow */
    borderColor: Dawn.border.subtle,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,180,80,0.025)',
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  inner: {
    backgroundColor: Dawn.surface.cardSecondary,
    borderRadius: 15,
    margin: 1,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconEmoji: {
    fontSize: 18,
  },
  titleEmoji: {
    fontSize: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
    flexShrink: 1,
  },
  description: {
    fontSize: 13,
    color: Dawn.text.secondary,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 12,
    opacity: 0.92,
  },
  cta: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.32)',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: Dawn.accent.sunrise,
    opacity: 0.82,
  },
  });
}

