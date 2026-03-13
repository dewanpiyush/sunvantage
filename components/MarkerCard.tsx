/**
 * Marker Card — collection-screen variant of the ritual card family.
 * Same visual DNA as RitualRevealCard (rounded container, border, spacing) but for the Ritual Markers list.
 * Two variants: earned (gold border, full opacity) and locked (dashed neutral border, 0.6 opacity).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Dawn } from '../constants/theme';

export type MarkerCardEarnedProps = {
  variant: 'earned';
  icon: string;
  title: string;
  description: string;
  earnedExplanation: string;
  earnedMonthYear: string;
};

export type MarkerCardLockedProps = {
  variant: 'locked';
  icon: string;
  title: string;
  lockedCopy: string;
};

export type MarkerCardProps = MarkerCardEarnedProps | MarkerCardLockedProps;

export default function MarkerCard(props: MarkerCardProps) {
  const isLocked = props.variant === 'locked';
  return (
    <View style={[styles.card, isLocked && styles.cardLocked]}>
      <View style={[styles.inner, isLocked && styles.innerLocked]}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{props.icon}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {props.title}
            {isLocked ? ' 🔒' : ''}
          </Text>
        </View>
        {isLocked ? (
          <Text style={styles.lockedCopy}>{props.lockedCopy}</Text>
        ) : (
          <>
            <Text style={styles.line1}>{props.description}</Text>
            <Text style={styles.line2}>{props.earnedExplanation}</Text>
            {props.earnedMonthYear ? (
              <View style={styles.dateStampWrap}>
                <Text style={styles.dateStamp}>{props.earnedMonthYear}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
    overflow: 'hidden',
    marginBottom: 11,
  },
  cardLocked: {
    opacity: 0.6,
    borderStyle: 'dashed',
    borderColor: Dawn.border.subtle,
  },
  inner: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 15,
    margin: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  innerLocked: {
    margin: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    flex: 1,
  },
  line1: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.primary,
    lineHeight: 20,
    marginBottom: 3,
  },
  line2: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 18,
    marginBottom: 5,
    opacity: 0.88,
  },
  dateStampWrap: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  dateStamp: {
    fontSize: 12,
    color: Dawn.text.secondary,
    opacity: 0.6,
    textAlign: 'right',
  },
  lockedCopy: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 18,
  },
});
