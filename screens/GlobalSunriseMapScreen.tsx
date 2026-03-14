/**
 * Global Sunrise Map: where sunrise has happened, is happening, and where users logged.
 * Calm, contemplative, minimal, cosmic.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import SunVantageHeader from '@/components/SunVantageHeader';
import WorldMap from '@/components/map/WorldMap';
import SunriseTerminator from '@/components/map/SunriseTerminator';
import CityDot from '@/components/map/CityDot';
import UserCityDot from '@/components/map/UserCityDot';
import GlobalSunriseStats from '@/components/GlobalSunriseStats';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const USER_CITY = {
  city: 'Delhi',
  lat: 28.6139,
  lng: 77.209,
};

const COMMUNITY_CITIES: Array<{ city: string; country: string; lat: number; lng: number; logs: number }> = [
  { city: 'Delhi', country: 'India', lat: 28.61, lng: 77.2, logs: 12 },
  { city: 'Mumbai', country: 'India', lat: 19.07, lng: 72.87, logs: 8 },
  { city: 'Bangkok', country: 'Thailand', lat: 13.75, lng: 100.5, logs: 5 },
  { city: 'Lisbon', country: 'Portugal', lat: 38.72, lng: -9.13, logs: 2 },
];

const MAX_CITY_DOTS = 200;

export default function GlobalSunriseMapScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const citiesToShow = useMemo(
    () => COMMUNITY_CITIES.slice(0, MAX_CITY_DOTS),
    []
  );

  const totalSunrises = useMemo(
    () => citiesToShow.reduce((s, c) => s + c.logs, 0),
    [citiesToShow]
  );

  const countryCount = useMemo(
    () => new Set(citiesToShow.map((c) => c.country)).size,
    [citiesToShow]
  );

  const mapHeight = height * 0.65;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SunVantageHeader
        showBack
        title="Global Sunrise Map"
        hideMenu
        onBackPress={() => router.back()}
        wrapperMarginBottom={0}
      />

      <View style={[styles.mapContainer, { height: mapHeight }]}>
        <WorldMap />
        <SunriseTerminator date={now} />
        {citiesToShow.map((city) => (
          <CityDot key={`${city.city}-${city.lat}`} city={city} now={now} />
        ))}
        <UserCityDot city={USER_CITY} now={now} />
      </View>

      <GlobalSunriseStats
        totalSunrises={totalSunrises}
        cityCount={citiesToShow.length}
        countryCount={countryCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  mapContainer: {
    width: '100%',
    backgroundColor: '#0B0F1A',
    overflow: 'hidden',
  },
});
