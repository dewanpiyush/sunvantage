/**
 * Global Sunrise Map: where sunrise has happened, is happening, and where users logged.
 * Fetches today's sunrise_logs aggregated by city and drives stats + map dots.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import SunVantageHeader from '@/components/SunVantageHeader';
import WorldMap from '@/components/map/WorldMap';
import SunriseTerminator from '@/components/map/SunriseTerminator';
import CityDot from '@/components/map/CityDot';
import UserCityDot from '@/components/map/UserCityDot';
import GlobalSunriseStats from '@/components/GlobalSunriseStats';
import { Dawn } from '@/constants/theme';
import { fetchGlobalSunriseLogs, type CityLogAggregate } from '@/lib/fetchGlobalSunriseLogs';
import supabase from '@/supabase';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const DEFAULT_USER_CITY = { city: 'Delhi', lat: 28.6139, lng: 77.209 };

export default function GlobalSunriseMapScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const { width, height } = useWindowDimensions();
  const [aggregate, setAggregate] = useState<{
    cities: CityLogAggregate[];
    totalWitnesses: number;
    cityCount: number;
    countryCount: number;
    userWitnessedToday: boolean;
  }>({ cities: [], totalWitnesses: 0, cityCount: 0, countryCount: 0, userWitnessedToday: false });
  const [userCity, setUserCity] = useState(DEFAULT_USER_CITY);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      const [agg, profileRes] = await Promise.all([
        fetchGlobalSunriseLogs(userId),
        userId
          ? supabase.from('profiles').select('city, latitude, longitude').eq('user_id', userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setAggregate(agg);
      const profile = profileRes.data as { city?: string | null; latitude?: number | null; longitude?: number | null } | null;
      const city = profile?.city?.trim();
      const lat = profile?.latitude;
      const lng = profile?.longitude;
      if (city && lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        setUserCity({ city, lat, lng });
      }
    } catch {
      setAggregate({ cities: [], totalWitnesses: 0, cityCount: 0, countryCount: 0, userWitnessedToday: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      loadData();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadData]);

  const userWitnessedToday = aggregate.userWitnessedToday;
  const isUserFirstWitness = userWitnessedToday && aggregate.totalWitnesses === 1;

  const mapHeight = height * 0.48;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SunVantageHeader
        showBack
        hideMenu
        showBranding
        title="Global Sunrise Map"
        subtitle="Celebrating the shared splendour of humanity"
        screenTitle
        wrapperMarginBottom={0}
        onBackPress={() => router.push('/home')}
      />

      <View style={[styles.mapContainer, { width, height: mapHeight }]}>
        <WorldMap width={width} height={mapHeight} />
        <SunriseTerminator date={now} width={width} height={mapHeight} />
        {aggregate.cities.map((city) => (
          <CityDot
            key={`${city.city}-${city.lat}-${city.lng}`}
            city={{ ...city, country: city.country || undefined }}
            now={now}
            width={width}
            height={mapHeight}
          />
        ))}
        <UserCityDot city={userCity} now={now} width={width} height={mapHeight} />
        <View style={styles.terminatorLabelContainer} pointerEvents="none">
          <View style={styles.terminatorLegend} aria-hidden>
            <View style={styles.terminatorLegendOuter} />
            <View style={styles.terminatorLegendMid} />
            <View style={styles.terminatorLegendCore} />
          </View>
          <Text style={styles.terminatorLabelText}>Sunrise now</Text>
        </View>
      </View>

      <GlobalSunriseStats
        totalWitnesses={aggregate.totalWitnesses}
        cityCount={aggregate.cityCount}
        countryCount={aggregate.countryCount}
        userWitnessedToday={userWitnessedToday}
        isUserFirstWitness={isUserFirstWitness}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
  },
  mapContainer: {
    width: '100%',
    marginTop: 20,
    backgroundColor: Dawn.background.primary,
    overflow: 'hidden',
    borderWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  terminatorLabelContainer: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 16, 35, 0.78)',
  },
  terminatorLegend: {
    width: 18,
    height: 10,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminatorLegendOuter: {
    position: 'absolute',
    width: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#F4C95D',
    opacity: 0.08,
  },
  terminatorLegendMid: {
    position: 'absolute',
    width: 18,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#F4C95D',
    opacity: 0.18,
  },
  terminatorLegendCore: {
    position: 'absolute',
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#F4C95D',
    opacity: 0.9,
  },
  terminatorLabelText: {
    fontSize: 12,
    color: '#E9F0FF',
  },
});
