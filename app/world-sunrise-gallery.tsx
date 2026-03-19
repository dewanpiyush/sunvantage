/**
 * Global Sunrise Gallery — gallery of recent sunrise photos from across SunVantage.
 * Reuses CitySunriseGallery grid + modal; pulls from global sunrise_logs (no city filter).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import CitySunriseGallery, { type CitySunriseGalleryRow } from '../components/CitySunriseGallery';
import { Dawn } from '../constants/theme';

const GALLERY_LIMIT = 30;

export default function WorldSunriseGalleryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<CitySunriseGalleryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
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

      const { data, error: fetchError } = await supabase.rpc('get_global_sunrise_gallery', {
        limit_count: GALLERY_LIMIT,
      });

      if (fetchError) {
        setError(fetchError.message || 'Could not load photos.');
        setRows([]);
        return;
      }
      setRows((data ?? []) as CitySunriseGalleryRow[]);
    } catch {
      setError('Something went wrong.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.gradientTop} pointerEvents="none" />
        <View style={styles.gradientMid} pointerEvents="none" />
        <View style={styles.gradientLowerWarm} pointerEvents="none" />
        <View style={styles.centered}>
          <ActivityIndicator color={Dawn.accent.sunrise} />
          <Text style={styles.loadingText}>Loading…</Text>
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Dawn.text.secondary,
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

