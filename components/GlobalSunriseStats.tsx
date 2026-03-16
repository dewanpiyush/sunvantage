/**
 * Global sunrise stats below the map: witnesses today, with user-aware copy.
 * Calm, collective tone; no gamified or competitive language.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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

  // Case 5 — Multiple witnesses across multiple cities
  return (
    <View style={styles.container}>
      <Text style={styles.mainLine}>
        {totalWitnesses.toLocaleString()} people have witnessed the sunrise on SunVantage today.
      </Text>
      {subLine ? <Text style={styles.subLine}>{subLine}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainLine: {
    fontSize: 15,
    color: '#AFC2DA',
    textAlign: 'center',
    marginBottom: 4,
  },
  subLine: {
    fontSize: 13,
    color: '#7A8BA3',
    textAlign: 'center',
  },
});
