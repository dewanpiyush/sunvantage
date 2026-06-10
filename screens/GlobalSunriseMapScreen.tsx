/**
 * Global Sunrise Map: where today's local sunrise has passed vs still awaits; dots = logs today.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Animated, Easing } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SunVantageHeader from '@/components/SunVantageHeader';
import WorldMap, { MAP_OCEAN_COLOR } from '@/components/map/WorldMap';
import MapLegend from '@/components/map/MapLegend';
import { SunriseAtmosphere, SunriseFrontier } from '@/components/map/SunriseTerminator';
import CityDot from '@/components/map/CityDot';
import UserCityDot from '@/components/map/UserCityDot';
import GlobalSunriseStats from '@/components/GlobalSunriseStats';
import { LinearGradient } from 'expo-linear-gradient';
import { useDawn } from '@/hooks/use-dawn';
import {
  fetchGlobalSunriseLogs,
  type CityLogAggregate,
  type UserLogPin,
} from '@/lib/fetchGlobalSunriseLogs';
import supabase from '@/supabase';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const HEADER_MAP_GAP = 16;
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
    userLogPin: UserLogPin | null;
  }>({
    cities: [],
    totalWitnesses: 0,
    cityCount: 0,
    countryCount: 0,
    userWitnessedToday: false,
    userLogPin: null,
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const agg = await fetchGlobalSunriseLogs(userId);
      setAggregate(agg);
    } catch {
      setAggregate({
        cities: [],
        totalWitnesses: 0,
        cityCount: 0,
        countryCount: 0,
        userWitnessedToday: false,
        userLogPin: null,
      });
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

  /** Progression curve moves with local sunrise times — refresh more often than log aggregates. */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const userWitnessedToday = aggregate.userWitnessedToday;
  const isUserFirstWitness = userWitnessedToday && aggregate.totalWitnesses === 1;

  /** Slightly taller so the map reads as the hero. */
  const mapHeight = height * 0.53;

  // Barely perceptible drift on the daylight boundary — atmospheric, not “live radar”.
  const arcPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(arcPulse, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(arcPulse, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [arcPulse]);

  const arcOpacity = arcPulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <View style={[styles.safe, { paddingTop: insets.top + TOP_SAFE_EXTRA, paddingBottom: insets.bottom }]}>
      <View style={styles.headerInset}>
        <SunVantageHeader
          showBack
          hideMenu
          showBranding
          title="Global Sunrise Map"
          subtitle="Where today's sunrise has passed — and where it still awaits"
          screenTitle
          wrapperMarginBottom={0}
          subtitleStyle={styles.headerSubtitleSoft}
          onBackPress={() => router.back()}
        />
      </View>

      <View style={[styles.mapContainer, { width, height: mapHeight, marginTop: HEADER_MAP_GAP }]}>
        <View style={[styles.mapLayer, styles.mapLayerOcean, { zIndex: 0 }]} />
        <Animated.View
          pointerEvents="none"
          style={[styles.mapLayer, styles.mapLayerAtmosphere, { opacity: arcOpacity, zIndex: 1 }]}
        >
          <SunriseAtmosphere date={now} width={width} height={mapHeight} />
        </Animated.View>
        <View style={[styles.mapLayer, { zIndex: 2 }]} pointerEvents="none">
          <WorldMap width={width} height={mapHeight} landOnly />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.mapLayer, styles.mapLayerFrontier, { opacity: arcOpacity, zIndex: 3 }]}
        >
          <SunriseFrontier date={now} width={width} height={mapHeight} />
        </Animated.View>
        <View style={[styles.mapLayer, styles.mapLayerDots, { zIndex: 4 }]} pointerEvents="box-none">
          {aggregate.cities.map((city) => (
            <CityDot
              key={`${city.city}-${city.lat}-${city.lng}`}
              city={{ ...city, country: city.country || undefined }}
              now={now}
              width={width}
              height={mapHeight}
            />
          ))}
          {aggregate.userLogPin ? (
            <UserCityDot
              city={aggregate.userLogPin}
              now={now}
              width={width}
              height={mapHeight}
            />
          ) : null}
        </View>

        <LinearGradient
          colors={['rgba(8,20,37,0.42)', 'rgba(8,20,37,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.vignetteTop, { zIndex: 5 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(8,20,37,0)', 'rgba(8,20,37,0.38)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.vignetteBottom, { zIndex: 5 }]}
          pointerEvents="none"
        />

        <View style={[styles.mapLayer, styles.mapLegend, { zIndex: 6 }]} pointerEvents="none">
          <MapLegend />
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
    backgroundColor: MAP_OCEAN_COLOR,
    overflow: 'hidden',
    /** Edge-to-edge canvas — no card frame competing with the map. */
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLayerOcean: {
    backgroundColor: MAP_OCEAN_COLOR,
  },
  mapLayerAtmosphere: {},
  mapLayerFrontier: {},
  mapLayerDots: {},
  mapLegend: {
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 12,
    paddingLeft: 14,
  },
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 56,
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
