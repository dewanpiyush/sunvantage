import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';

function getStreakLines(
  currentStreak: number,
  longestStreak: number
): { primary: string; secondary: string; secondaryCompact: string } {
  const dayWord = (n: number) => (n === 1 ? 'day' : 'days');
  // Compact single-line uses "N day streak" (e.g. "2 day streak")
  const primary = `${currentStreak} day streak`;
  let secondary: string;
  let secondaryCompact: string;
  if (currentStreak >= 5 && currentStreak === longestStreak) {
    secondary = 'Your longest so far';
    secondaryCompact = 'Your longest so far';
  } else {
    secondary = `Longest: ${longestStreak} ${dayWord(longestStreak)}`;
    secondaryCompact = `Longest ${longestStreak}`;
  }
  return { primary, secondary, secondaryCompact };
}

type Props = {
  currentStreak: number;
  longestStreak: number;
  loading?: boolean;
  style?: ViewStyle;
  /** When true and currentStreak === 1, hide the "Longest streak" line (first ever sunrise). */
  hideLongestWhenFirst?: boolean;
};

export default function StreakBlock({ currentStreak, longestStreak, loading = false, style, hideLongestWhenFirst = false }: Props) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const blockStyle = [styles.streakBlock, style];

  if (loading) {
    return (
      <View style={blockStyle}>
        <ActivityIndicator size="small" color={Dawn.text.secondary} />
      </View>
    );
  }

  const { primary, secondary, secondaryCompact } = getStreakLines(currentStreak, longestStreak);
  const showLongest = !(hideLongestWhenFirst && currentStreak === 1);

  return (
    <View style={blockStyle}>
      {currentStreak > 0 ? (
        <View style={styles.streakRow}>
          <Text style={styles.emoji}>🔥</Text>
          <Text style={styles.streakPrimary}>
            {primary}
            {showLongest ? ` · ${secondaryCompact}` : ''}
          </Text>
        </View>
      ) : longestStreak > 0 ? (
        <>
          <Text style={styles.headerInvitation}>Ready to begin again?</Text>
          <Text style={styles.streakSecondary}>
            Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  streakBlock: {
    marginTop: 16,
    paddingVertical: 2,
    marginBottom: 8,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 16,
    marginRight: 6,
  },
  streakPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  streakSecondary: {
    marginTop: 4,
    fontSize: 13,
    color: Dawn.text.secondary,
    opacity: 0.9,
  },
  headerInvitation: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.primary,
  },
  });
}
