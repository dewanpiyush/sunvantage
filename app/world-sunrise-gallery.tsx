/**
 * Global Sunrise Gallery — gallery of recent sunrise photos from across SunVantage.
 * Reuses CitySunriseGallery grid + modal; pulls from global sunrise_logs (no city filter).
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import CitySunriseGallery, { type CitySunriseGalleryRow } from '../components/CitySunriseGallery';
import { Dawn } from '../constants/theme';
import { useDawn } from '@/hooks/use-dawn';
import { getWorldGalleryCache, isWorldGalleryCacheFresh, prefetchWorldGallery } from '@/lib/screenDataCache';

const GALLERY_LIMIT = 30;

export default function WorldSunriseGalleryScreen() {
  const router = useRouter();
  const DawnHook = useDawn();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<CitySunriseGalleryRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (sessionError || !userId) {
        setError('Please sign in to see shared sunrises.');
        setRows([]);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(userId);
      const cached = await prefetchWorldGallery(userId, { force: true });
      if (!cached) {
        setError('Could not load photos.');
        setRows([]);
        return;
      }
      setRows(cached.rows as CitySunriseGalleryRow[]);
    } catch {
      setError('Something went wrong.');
      setRows([]);
    } finally {
      if (!silent) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const bootstrap = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          void load({ silent: hasLoadedOnce.current });
          return;
        }
        const cached = getWorldGalleryCache(userId);
        if (cached) {
          setCurrentUserId(userId);
          setRows(cached.rows as CitySunriseGalleryRow[]);
          setLoading(false);
          hasLoadedOnce.current = true;
        }
        if (!cached || !isWorldGalleryCacheFresh(userId)) {
          void load({ silent: Boolean(cached) });
        }
      };
      void bootstrap();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.gradientTop} pointerEvents="none" />
        <View style={styles.gradientMid} pointerEvents="none" />
        <View style={styles.gradientLowerWarm} pointerEvents="none" />
        <View style={styles.header}>
          <SunVantageHeader
            showBack
            hideMenu
            showBranding
            title="Global Sunrises Welcomed"
            onBackPress={() => router.back()}
            hasLoggedToday={false}
            screenTitle={false}
            onHeaderPress={() => router.push('/home')}
          />
          <Text style={styles.headerLine}>Some recent shared mornings on SunVantage.</Text>
        </View>
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonGrid}>
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
            <View style={styles.skeletonTile} />
          </View>
          <View style={styles.skeletonFooterLine} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.gradientMid} pointerEvents="none" />
      <View style={styles.gradientLowerWarm} pointerEvents="none" />

      <View style={styles.header}>
        <SunVantageHeader
          showBack
          hideMenu
          showBranding
          title="Global Sunrises Welcomed"
          onBackPress={() => router.back()}
          hasLoggedToday={false}
          screenTitle={false}
          onHeaderPress={() => router.push('/home')}
        />
        <Text style={styles.headerLine}>Some recent shared mornings on SunVantage.</Text>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No shared sunrises here yet.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={DawnHook.accent.sunrise}
            />
          }
        >
          <CitySunriseGallery
            rows={rows}
            limit={GALLERY_LIMIT}
            currentUserId={currentUserId}
            showCityOverlay
          />
          <Text style={styles.footerLine}>Each dawn looks different from somewhere new.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
    paddingTop: 52,
  },
  gradientTop: {
    ...StyleSheet.absoluteFillObject,
    height: '50%',
    backgroundColor: Dawn.background.primary,
  },
  gradientMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    height: '30%',
    backgroundColor: 'rgba(148, 163, 184, 0.055)',
  },
  gradientLowerWarm: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    bottom: 0,
    backgroundColor: 'rgba(255, 179, 71, 0.058)',
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerLine: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(231, 238, 247, 0.65)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  footerLine: {
    marginTop: 14,
    fontSize: 13,
    color: 'rgba(231, 238, 247, 0.65)',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skeletonWrap: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  skeletonTile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  skeletonFooterLine: {
    width: '72%',
    height: 12,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
});

