/**
 * Global Sunrise Map: where sunrise has happened, is happening, and where users logged.
 * Fetches today's sunrise_logs aggregated by city and drives stats + map dots.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Animated, Easing } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SunVantageHeader from '@/components/SunVantageHeader';
import WorldMap from '@/components/map/WorldMap';
import SunriseTerminator from '@/components/map/SunriseTerminator';
import CityDot from '@/components/map/CityDot';
import UserCityDot from '@/components/map/UserCityDot';
import GlobalSunriseStats from '@/components/GlobalSunriseStats';
import { LinearGradient } from 'expo-linear-gradient';
import { useDawn } from '@/hooks/use-dawn';
import { fetchGlobalSunriseLogs, type CityLogAggregate } from '@/lib/fetchGlobalSunriseLogs';
import supabase from '@/supabase';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const DEFAULT_USER_CITY = { city: 'Delhi', lat: 28.6139, lng: 77.209 };

const HEADER_MAP_GAP = 20;
const TOP_SAFE_EXTRA = 8;

export default function GlobalSunriseMapScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
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

  /** Slightly taller so the map reads as the hero. */
  const mapHeight = height * 0.53;

  // Extremely gentle “time passing” motion for the terminator arc.
  const arcDrift = useRef(new Animated.Value(0)).current;
  const arcPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(arcDrift, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(arcDrift, { toValue: 0, duration: 16000, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(arcPulse, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(arcPulse, { toValue: 0, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    drift.start();
    pulse.start();
    return () => {
      drift.stop();
      pulse.stop();
    };
  }, [arcDrift, arcPulse]);

  const arcTranslateX = arcDrift.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const arcOpacity = arcPulse.interpolate({ inputRange: [0, 1], outputRange: [0.62, 0.75] });

  return (
    <View style={[styles.safe, { paddingTop: insets.top + TOP_SAFE_EXTRA, paddingBottom: insets.bottom }]}>
      <View style={styles.headerInset}>
        <SunVantageHeader
          showBack
          hideMenu
          showBranding
          title="Global Sunrise Map"
          subtitle="Celebrating the shared splendour of humanity"
          screenTitle
          wrapperMarginBottom={0}
          subtitleStyle={styles.headerSubtitleSoft}
          onBackPress={() => router.push('/home')}
        />
      </View>

      <View style={[styles.mapContainer, { width, height: mapHeight, marginTop: HEADER_MAP_GAP }]}>
        <WorldMap width={width} height={mapHeight} />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: arcOpacity, transform: [{ translateX: arcTranslateX }] }]}
        >
          <SunriseTerminator date={now} width={width} height={mapHeight} />
        </Animated.View>
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

        {/* Subtle vignette to blend arc/map into the atmosphere. */}
        <LinearGradient
          colors={['rgba(14,34,61,0.45)', 'rgba(14,34,61,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.vignetteTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(14,34,61,0)', 'rgba(14,34,61,0.35)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.vignetteBottom}
          pointerEvents="none"
        />

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
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
  },
  headerInset: {
    paddingHorizontal: 24,
  },
  /** Softer than default secondary — lets the map dominate. */
  headerSubtitleSoft: {
    opacity: 0.6,
    lineHeight: 22,
  },
  mapContainer: {
    width: '100%',
    backgroundColor: Dawn.background.primary,
    overflow: 'hidden',
    /** Edge-to-edge canvas — no card frame competing with the map. */
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  terminatorLabelContainer: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    opacity: 0.88,
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
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 52,
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  });
}
