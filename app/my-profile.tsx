import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import supabase from '../supabase';
import { BADGE_REGISTRY, BADGE_ICONS, computeBadgeStats } from './ritual-markers';
import SunVantageHeader from '../components/SunVantageHeader';
import { hasLoggedToday } from '../lib/hasLoggedToday';
import { Dawn } from '../constants/theme';

const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 512;

// ----- Streak computation (client-side) -----
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function createdAtToLocalDateString(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getYesterdayLocalDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getPreviousDayString(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const y2 = date.getFullYear();
  const m2 = date.getMonth();
  const d2 = date.getDate();
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}

function computeStreakFromLogDates(
  createdAts: string[]
): { current: number; longest: number; lastDate: string | null } {
  const validDates = createdAts
    .map(createdAtToLocalDateString)
    .filter((s): s is string => Boolean(s) && YMD_REGEX.test(s));
  if (validDates.length === 0) return { current: 0, longest: 0, lastDate: null };
  const today = getTodayLocalDateString();
  const yesterday = getYesterdayLocalDateString();
  const dateStrings = [...new Set(validDates)].sort().reverse();
  const lastDate = dateStrings[0];
  const lastIsActive = lastDate === today || lastDate === yesterday;
  let current = 0;
  if (lastIsActive) {
    let expected = lastDate;
    for (const d of dateStrings) {
      if (d !== expected) break;
      current++;
      expected = getPreviousDayString(expected);
    }
  }
  let longest = 0;
  let run = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    if (getPreviousDayString(dateStrings[i - 1]) === dateStrings[i]) run++;
    else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run, current);
  return { current, longest, lastDate };
}

function formatSinceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toTitleCase(text: string): string {
  if (!text) return text;
  return text
    .split(' ')
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

import { getNormalizedVantageFromRow, toTitleCaseVantage } from '../lib/vantageUtils';

function isHomeLikePlace(place: string): boolean {
  const n = place.trim().toLowerCase();
  const homeLike = ['home', 'room', 'balcony', 'terrace', 'window', 'yard'];
  return homeLike.some((w) => n === w || n.split(/\s+/).includes(w));
}

const NUMBER_WORDS: Record<number, string> = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
  6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
};
function morningsGreetedText(n: number): string {
  if (n <= 0) return '';
  const word = NUMBER_WORDS[n] ?? String(n);
  const mornings = n === 1 ? 'morning' : 'mornings';
  return n === 1
    ? 'One morning greeted.'
    : `${word} ${mornings} greeted. A ritual taking shape.`;
}

type ProfileRow = { first_name: string | null; city: string | null; avatar_url: string | null };
type LogRow = {
  created_at: string;
  vantage_name: string | null;
  normalized_vantage?: string | null;
  user_input_vantage?: string | null;
  reflection_text: string | null;
  city?: string | null;
};

export default function MyProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        setError('Please sign in to see your profile.');
        setProfile(null);
        setLogs([]);
        return;
      }

      const [profileRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('first_name, city, avatar_url').eq('user_id', userId).maybeSingle(),
        supabase
          .from('sunrise_logs')
          .select('created_at, vantage_name, normalized_vantage, user_input_vantage, reflection_text, city')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ]);

      if (profileRes.error) {
        if (/avatar_url|column.*does not exist/i.test(profileRes.error.message ?? '')) {
          const { data: profileFallback } = await supabase
            .from('profiles')
            .select('first_name, city')
            .eq('user_id', userId)
            .maybeSingle();
          setProfile(profileFallback ? { ...profileFallback, avatar_url: null } : null);
        } else {
          setError(profileRes.error.message || 'Could not load profile.');
          return;
        }
      } else {
        setProfile(profileRes.data ?? null);
      }
      if (logsRes.error) {
        if (/column.*does not exist|city|normalized_vantage|user_input_vantage/i.test(logsRes.error.message ?? '')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('sunrise_logs')
            .select('created_at, vantage_name, reflection_text')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          if (fallbackError) {
            setError(fallbackError.message || 'Could not load your mornings.');
            return;
          }
          setLogs((fallbackData ?? []) as LogRow[]);
        } else {
          setError(logsRes.error.message || 'Could not load your mornings.');
          return;
        }
      } else {
        setLogs((logsRes.data ?? []) as LogRow[]);
      }
    } catch {
      setError('Something went wrong.');
      setProfile(null);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadAvatarFromUri = useCallback(async (uri: string, userId: string) => {
    setUploadingAvatar(true);
    setError('');
    try {
      const manipulated = await manipulateAsync(
        uri,
        [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
        { compress: 0.9, format: SaveFormat.JPEG }
      );
      if (!manipulated.uri) {
        setError('Could not prepare image.');
        return;
      }
      const file = new File(manipulated.uri);
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const path = `${userId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        setError(uploadError.message || 'Upload failed.');
        return;
      }
      const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = urlData?.publicUrl ?? null;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', userId);
      if (updateError) {
        setError(updateError.message || 'Could not update profile.');
        return;
      }
      // Cache-bust so the image component refetches (same path is overwritten in storage)
      const displayUrl = avatarUrl ? `${avatarUrl}?t=${Date.now()}` : null;
      setProfile((prev) => (prev ? { ...prev, avatar_url: displayUrl } : null));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      __DEV__ && console.error('[Profile] avatar upload error', e);
      setError(message || 'Something went wrong.');
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  const removeAvatar = useCallback(async (userId: string) => {
    setUploadingAvatar(true);
    setError('');
    try {
      await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}.jpg`]);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', userId);
      if (updateError) {
        setError(updateError.message || 'Could not update profile.');
        return;
      }
      setProfile((prev) => (prev ? { ...prev, avatar_url: null } : null));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      __DEV__ && console.error('[Profile] avatar remove error', e);
      setError(message || 'Something went wrong.');
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  const handleAvatarPress = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const hasAvatar = Boolean(profile?.avatar_url?.trim());
    const options: { text: string; onPress?: () => void }[] = [
      {
        text: 'Take photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            setError('Camera access is needed to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
          });
          if (result.canceled || !result.assets?.[0]?.uri) return;
          await uploadAvatarFromUri(result.assets[0].uri, userId);
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            setError('Photo library access is needed.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
          });
          if (result.canceled || !result.assets?.[0]?.uri) return;
          await uploadAvatarFromUri(result.assets[0].uri, userId);
        },
      },
    ];
    if (hasAvatar) {
      options.push({
        text: 'Remove photo',
        onPress: () => removeAvatar(userId),
      });
    }
    options.push({ text: 'Cancel', onPress: () => {} });
    Alert.alert(
      'Profile photo',
      undefined,
      options.map((o) => ({
        text: o.text,
        onPress: o.onPress,
        style: o.text === 'Cancel' ? 'cancel' : undefined,
      }))
    );
  }, [profile?.avatar_url, uploadAvatarFromUri, removeAvatar]);

  useEffect(() => {
    load();
  }, [load]);

  const createdAts = logs.map((r) => r.created_at);
  const streak = computeStreakFromLogDates(createdAts);
  const totalMornings = logs.length;
  const earliestIso = createdAts.length > 0 ? createdAts[0] : null;
  const sinceText = earliestIso ? formatSinceDate(earliestIso) : null;

  const vantageCounts = new Map<string, { name: string; count: number }>();
  for (const row of logs) {
    const norm = getNormalizedVantageFromRow(row);
    if (norm === null) continue;
    const cur = vantageCounts.get(norm);
    if (cur) {
      cur.count += 1;
    } else {
      vantageCounts.set(norm, { name: toTitleCaseVantage(norm), count: 1 });
    }
  }
  const uniqueVantageCount = vantageCounts.size;
  let mostReturned: { name: string; count: number } | null = null;
  for (const v of vantageCounts.values()) {
    if (!mostReturned || v.count > mostReturned.count) mostReturned = v;
  }
  const hasMovement = uniqueVantageCount > 0 && mostReturned != null;

  const badgeStats = computeBadgeStats(logs);
  const earnedBadges = BADGE_REGISTRY.filter((b) => b.criteria(badgeStats));
  const previewBadges = earnedBadges.slice(0, 2);
  const hasRitualMarkers = earnedBadges.length > 0;

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
        <SunVantageHeader showBack hideMenu showBranding title="My Profile" hasLoggedToday={hasLoggedToday(logs)} />
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Profile header card */}
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.profileHeaderRow}>
                <View style={styles.profileHeaderText}>
                  <Text style={styles.userName}>
                    {profile?.first_name?.trim() || 'Welcome'}
                  </Text>
                  {profile?.city?.trim() ? (
                    <Text style={styles.userCity}>{profile.city.trim()}</Text>
                  ) : null}
                  {sinceText ? (
                    <Text style={styles.sinceText}>
                      You've been greeting the morning since {sinceText}.
                    </Text>
                  ) : null}
                </View>
                <View style={styles.avatarColumn}>
                  <Pressable
                    style={({ pressed }) => [styles.avatarCircle, pressed && styles.avatarCirclePressed]}
                    onPress={handleAvatarPress}
                    disabled={uploadingAvatar}
                  >
                    {profile?.avatar_url ? (
                      <Image
                        source={{ uri: profile.avatar_url }}
                        style={styles.avatarImage}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {(profile?.first_name?.trim() || 'W').charAt(0).toUpperCase()}
                      </Text>
                    )}
                    {uploadingAvatar ? (
                      <View style={styles.avatarOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                  <Text style={styles.avatarCaption}>
                    {profile?.avatar_url ? 'Change photo' : 'Add photo'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. My sunrise streak card */}
          <View style={styles.card}>
            <View style={styles.cardInner}>
              <Text style={styles.ritualCardTitle}>🔥 My sunrise streak</Text>
              <View style={styles.statsRow}>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>Current streak</Text>
                  <Text style={styles.statValue}>
                    {streak.current === 0
                      ? '—'
                      : `${streak.current} morning${streak.current === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>Longest streak</Text>
                  <Text style={styles.statValue}>
                    {streak.longest === 0
                      ? '—'
                      : `${streak.longest} morning${streak.longest === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <View style={styles.statColumn}>
                  <Text style={styles.statLabel}>Sunrises welcomed</Text>
                  <Text style={styles.statValue}>
                    {totalMornings === 0
                      ? '—'
                      : `${totalMornings} morning${totalMornings === 1 ? '' : 's'}`}
                  </Text>
                </View>
              </View>
              {totalMornings > 0 && (
                <Text style={styles.reflectiveLine}>
                  {morningsGreetedText(totalMornings)}
                </Text>
              )}
            </View>
          </View>

          {/* 3. Places of sunrise card */}
          {hasMovement && (
            <View style={styles.card}>
              <View style={styles.cardInner}>
                <Text style={styles.placesCardTitle}>📍 Places that held your sunrise</Text>
                <Text style={styles.placesSub}>
                  {uniqueVantageCount} unique vantage point{uniqueVantageCount === 1 ? '' : 's'}
                </Text>
                <Text style={styles.mostReturnedLabel}>Most returned to</Text>
                <View style={styles.mostReturnedRow}>
                  <Text style={styles.mostReturnedEmoji}>
                    {mostReturned && isHomeLikePlace(mostReturned.name) ? '🏠' : '📍'}
                  </Text>
                  <View>
                    <Text style={styles.mostReturnedName}>{toTitleCase(mostReturned!.name)}</Text>
                    <Text style={styles.mostReturnedCount}>
                      {mostReturned!.count} morning{mostReturned!.count === 1 ? '' : 's'} here
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* 4. Ritual markers preview card */}
          {hasRitualMarkers && (
            <View style={styles.card}>
              <View style={styles.cardInner}>
                <View style={styles.markersCardHeader}>
                  <View style={styles.titleRow}>
                    <Text style={styles.titleEmoji}>✨</Text>
                    <Text style={styles.markersCardTitle}>Ritual Markers</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.viewAllLink, pressed && { opacity: 0.72 }]}
                    onPress={() => router.push('/ritual-markers')}
                  >
                    <Text style={styles.viewAllLinkText}>View all →</Text>
                  </Pressable>
                </View>
                {previewBadges.map((badge) => (
                  <View key={badge.id} style={styles.markerPreviewRow}>
                    <Text style={styles.markerPreviewIcon}>{BADGE_ICONS[badge.id]}</Text>
                    <View style={styles.markerPreviewText}>
                      <Text style={styles.markerPreviewTitle}>{badge.title}</Text>
                      <Text style={styles.markerPreviewDescription}>{badge.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleEmoji: {
    fontSize: 17,
    lineHeight: 20,
  },
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
    overflow: 'hidden',
    marginBottom: 24,
  },
  cardInner: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 15,
    margin: 1,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileHeaderText: {
    flex: 1,
    marginRight: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 4,
  },
  userCity: {
    fontSize: 16,
    color: Dawn.text.secondary,
    marginBottom: 8,
  },
  sinceText: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 20,
    marginTop: 4,
  },
  avatarColumn: {
    alignItems: 'center',
  },
  avatarCaption: {
    fontSize: 12,
    opacity: 0.65,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(175, 194, 218, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarCirclePressed: {
    opacity: 0.9,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  ritualCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 16,
  },
  statColumn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    color: Dawn.text.secondary,
    marginBottom: 0,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  reflectiveLine: {
    fontSize: 14,
    color: Dawn.text.secondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  placesCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
  },
  placesSub: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 12,
  },
  mostReturnedLabel: {
    fontSize: 13,
    color: Dawn.text.secondary,
    marginBottom: 6,
  },
  mostReturnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mostReturnedEmoji: {
    fontSize: 20,
  },
  mostReturnedName: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  mostReturnedCount: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginTop: 2,
  },
  markersCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  markersCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  viewAllLink: {},
  viewAllLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.accent.sunrise,
  },
  markerPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  markerPreviewIcon: {
    fontSize: 20,
  },
  markerPreviewText: {
    flex: 1,
  },
  markerPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 2,
  },
  markerPreviewDescription: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 20,
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
});
