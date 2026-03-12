import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { Dawn } from '../constants/theme';

function getStreakLines(
  currentStreak: number,
  longestStreak: number
): { primary: string; secondary: string } {
  const dayWord = (n: number) => (n === 1 ? 'day' : 'days');
  const primary = `${currentStreak} ${dayWord(currentStreak)} streak`;
  let secondary: string;
  if (currentStreak >= 5 && currentStreak === longestStreak) {
    secondary = 'Your longest so far';
  } else {
    secondary = `Longest: ${longestStreak} ${dayWord(longestStreak)}`;
  }
  return { primary, secondary };
}

type Props = {
  currentStreak: number;
  longestStreak: number;
  loading?: boolean;
  style?: ViewStyle;
};

export default function StreakBlock({ currentStreak, longestStreak, loading = false, style }: Props) {
  const blockStyle = [styles.streakBlock, style];

  if (loading) {
    return (
      <View style={blockStyle}>
        <ActivityIndicator size="small" color={Dawn.text.secondary} />
      </View>
    );
  }

  const { primary, secondary } = getStreakLines(currentStreak, longestStreak);

  return (
    <View style={blockStyle}>
      {currentStreak > 0 ? (
        <>
          <View style={styles.streakRow}>
            <Text style={styles.emoji}>🔥</Text>
            <Text style={styles.streakPrimary}>{primary}</Text>
          </View>
          <Text style={styles.streakSecondary}>{secondary}</Text>
        </>
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

const styles = StyleSheet.create({
  streakBlock: {
    marginTop: 12,
    paddingVertical: 2,
    marginBottom: 16,
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
