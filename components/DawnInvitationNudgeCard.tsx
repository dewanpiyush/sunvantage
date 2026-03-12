import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Dawn } from '@/constants/theme';

type Props = {
  onPress: () => void;
};

export default function DawnInvitationNudgeCard({ onPress }: Props) {
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

          <Text style={styles.description}>
            Invite someone to greet tomorrow&apos;s sunrise with you.
          </Text>

          <Pressable style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]} onPress={onPress}>
            <Text style={styles.ctaText}>Send invitation</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 16,
  },
  card: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,180,80,0.06)',
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  inner: {
    backgroundColor: Dawn.surface.card,
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
  },
  cta: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: Dawn.accent.sunriseOn,
  },
});

