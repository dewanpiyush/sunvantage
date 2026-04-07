/**
 * Global sunrise stats below the map: witnesses today, with user-aware copy.
 * Calm, collective tone; no gamified or competitive language.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

type Props = {
  totalWitnesses: number;
  cityCount: number;
  countryCount: number;
  userWitnessedToday: boolean;
  isUserFirstWitness: boolean;
};

export default function GlobalSunriseStats({
  totalWitnesses,
  cityCount,
  countryCount,
  userWitnessedToday,
  isUserFirstWitness,
}: Props) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const subLine =
    cityCount > 1
      ? `Across ${cityCount.toLocaleString()} ${pluralize(cityCount, 'city', 'cities')}.`
      : null;

  // Case 1 — No one has logged yet
  if (totalWitnesses === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.mainLine}>
          Be the first to witness the sunrise today on SunVantage.
        </Text>
        <Text style={styles.subLine}>Across the globe.</Text>
      </View>
    );
  }

  // Case 2 — One city but multiple witnesses (do not show "Across 1 city")
  if (totalWitnesses > 1 && cityCount === 1) {
    return (
      <View style={styles.container}>
        <Text style={styles.mainLine}>
          {totalWitnesses.toLocaleString()} people witnessed the sunrise today on SunVantage.
        </Text>
      </View>
    );
  }

  // Case 3 — Only one witness and it is the current user
  if (totalWitnesses === 1 && isUserFirstWitness) {
    return (
      <View style={styles.container}>
        <Text style={styles.mainLine}>
          You are the first to witness the sunrise today on SunVantage.
        </Text>
        <Text style={styles.subLine}>Across the globe.</Text>
      </View>
    );
  }

  // Case 4 — Only one witness and it is NOT the current user (do not show city count)
  if (totalWitnesses === 1 && !isUserFirstWitness) {
    return (
      <View style={styles.container}>
        <Text style={styles.mainLine}>
          1 person has witnessed the sunrise today on SunVantage.
        </Text>
      </View>
    );
  }

  // Case 5 — Multiple witnesses across multiple cities (hierarchical layout)
  if (totalWitnesses >= 2 && cityCount >= 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.countLine}>
          {'\u{1F305}'} {totalWitnesses.toLocaleString()} people
        </Text>
        <Text style={styles.mainLine}>greeted the sunrise today</Text>
        {subLine ? <Text style={styles.subLine}>{subLine}</Text> : null}
      </View>
    );
  }

  // Fallback (should rarely hit): keep the calm plural wording
  return (
    <View style={styles.container}>
      <Text style={styles.mainLine}>
        {totalWitnesses.toLocaleString()} people have witnessed the sunrise on SunVantage today.
      </Text>
      {subLine ? <Text style={styles.subLine}>{subLine}</Text> : null}
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  container: {
    width: '85%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 8,
    marginTop: 0,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLine: {
    fontSize: 17,
    fontWeight: '500',
    color: Dawn.text.primary,
    textAlign: 'center',
    marginBottom: 2,
  },
  mainLine: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subLine: {
    fontSize: 13,
    color: Dawn.text.secondary,
    textAlign: 'center',
    opacity: 0.85,
  },
  });
}
