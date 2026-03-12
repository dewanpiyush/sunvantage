/**
 * My City's Sunrises — gallery of sunrise photos shared by others in the same city.
 * Reuses CitySunriseGallery (same grid + modal as "Morning light across {city}" in My Mornings).
 * Nav entry is conditional: only shown when count(other users' photos in city) > 1.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import CitySunriseGallery, { type CitySunriseGalleryRow } from '../components/CitySunriseGallery';
import { Dawn } from '../constants/theme';

const GALLERY_LIMIT = 21;

export default function MyCitySunrisesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cityName, setCityName] = useState<string | null>(null);
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
        setError('Please sign in to see your city’s sunrises.');
        setRows([]);
        setCityName(null);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(userId);

      const profileRes = await supabase
        .from('profiles')
        .select('city')
        .eq('user_id', userId)
        .maybeSingle();
      const city = (profileRes.data as { city?: string } | null)?.city?.trim() ?? null;
      setCityName(city);

      if (!city) {
        setRows([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('sunrise_logs')
        .select('photo_url, vantage_name, created_at, vantage_category, user_id')
        .eq('city', city)
        .neq('user_id', userId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(GALLERY_LIMIT);

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
          title="My City's Sunrises"
        />
        {cityName ? (
          <Text style={styles.headerLine}>
            Some recent shared mornings in {cityName}.
          </Text>
        ) : null}
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
          <CitySunriseGallery rows={rows} limit={GALLERY_LIMIT} cityFallback={cityName} currentUserId={currentUserId} />
          <Text style={styles.footerLine}>
            Each dawn looks different from somewhere new.
          </Text>
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
