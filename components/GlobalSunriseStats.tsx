/**
 * Global sunrise stats shown below the map: sunrises witnessed today, cities, countries.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  totalSunrises: number;
  cityCount: number;
  countryCount: number;
};

export default function GlobalSunriseStats({ totalSunrises, cityCount, countryCount }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.mainLine}>
        🌅 {totalSunrises.toLocaleString()} people chose to witness sunrise today
      </Text>
      <Text style={styles.subLine}>
        Across {cityCount.toLocaleString()} cities
        {countryCount > 0 ? ` • ${countryCount} countries` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 24,
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
