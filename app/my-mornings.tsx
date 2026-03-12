import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import CitySunriseGallery from '../components/CitySunriseGallery';
import { hasLoggedToday } from '../lib/hasLoggedToday';
import { Dawn } from '../constants/theme';

// Local map: reflection_question_id → question text (align with prompts used when saving).
// Extend this when you add more questions or persist question_id in sunrise_logs.
export const REFLECTION_QUESTION_MAP: Record<number, string> = {
  0: 'What are you grateful for this morning?',
  1: 'What feels quietly good right now?',
  2: 'What did you notice that you might have missed?',
  3: 'What feels steady in your life today?',
  4: 'Who or what made this morning possible?',
  5: 'What small thing deserves appreciation?',
  6: 'What are you carrying forward from yesterday?',
  7: 'What feels lighter after stepping outside?',
  8: 'What did the sky remind you of?',
  9: "What are you thankful for — even if it's ordinary?",
  10: 'What part of today feels full of possibility?',
  11: 'What feels enough, just as it is?',
  12: 'What are you choosing to begin again with today?',
  13: 'What deserves your attention today?',
  14: 'What feels quietly hopeful?',
};

const REFLECTION_INVITATIONS = [
  'What stayed with you?',
  'What small thing deserves appreciation?',
];

function getReflectionInvitationForDate(createdAtIso: string): string {
  const d = new Date(createdAtIso);
  if (Number.isNaN(d.getTime())) return REFLECTION_INVITATIONS[0];
  const daySeed = d.getFullYear() + d.getMonth() + d.getDate();
  return REFLECTION_INVITATIONS[daySeed % REFLECTION_INVITATIONS.length];
}

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function capitalizeFirstForDisplay(text: string): string {
  if (!text || text.length === 0) return text;
  const first = text[0];
  if (first >= 'a' && first <= 'z') return first.toUpperCase() + text.slice(1);
  return text;
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

type SunriseLogRow = {
  id: number;
  created_at: string;
  vantage_name: string | null;
  reflection_text: string | null;
  reflection_question_id: number | null;
  photo_url: string | null;
};

type CityGalleryRow = {
  photo_url: string;
  vantage_name: string | null;
  created_at: string;
  city?: string | null;
  vantage_category?: 'private' | 'public' | null;
  user_id?: string | null;
};

const photoBucket = 'sunrise_photos';
const signedUrlExpirySeconds = 60 * 60;

async function resolvePhotoDisplayUrl(ref: string): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
  const normalizedRef = ref.replace(/^\/+/, '').replace(new RegExp(`^${photoBucket}\/`), '');

  const { data, error } = await supabase.storage
    .from(photoBucket)
    .createSignedUrl(normalizedRef, signedUrlExpirySeconds);

  if (!error && data?.signedUrl) return data.signedUrl;

  // Fallback: if bucket is public, this will render without signed URLs.
  const publicUrl = supabase.storage.from(photoBucket).getPublicUrl(normalizedRef).data?.publicUrl;
  return publicUrl ?? null;
}

const GALLERY_LIMIT = 10;

export default function MyMorningsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<SunriseLogRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCity, setUserCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [galleryRows, setGalleryRows] = useState<CityGalleryRow[]>([]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (sessionError || !userId) {
        setError('Please sign in to see your mornings.');
        setLogs([]);
        setUserCity(null);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(userId);

      const [logsRes, profileRes] = await Promise.all([
        supabase
          .from('sunrise_logs')
          .select('id, created_at, vantage_name, reflection_text, reflection_question_id, photo_url')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('city').eq('user_id', userId).maybeSingle(),
      ]);

      const profileData = profileRes.data as { city: string | null } | null;
      setUserCity(profileData?.city?.trim() ?? null);

      const { data, error: fetchError } = logsRes;
      if (fetchError) {
        setError(fetchError.message || 'Could not load your mornings.');
        setLogs([]);
        return;
      }

      const rows = (data ?? []) as SunriseLogRow[];
      setLogs(rows);

      const urlMap: Record<number, string | null> = {};
      await Promise.all(
        rows.map(async (row) => {
          const ref = row.photo_url ?? null;
          if (!ref) {
            urlMap[row.id] = null;
            return;
          }
          const url = await resolvePhotoDisplayUrl(ref);
          urlMap[row.id] = url ?? null;
        })
      );
      setImageUrls((prev) => ({ ...prev, ...urlMap }));
    } catch {
      setError('Something went wrong.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGallery = useCallback(async (city: string) => {
    const trimmed = city.trim();
    if (!trimmed) return;
    try {
      const { data, error: galleryError } = await supabase
        .from('sunrise_logs')
        .select('photo_url, vantage_name, created_at, city, vantage_category, user_id')
        .eq('city', trimmed)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(GALLERY_LIMIT);

      if (galleryError || !data?.length) {
        setGalleryRows([]);
        return;
      }
      setGalleryRows(data as CityGalleryRow[]);
    } catch {
      setGalleryRows([]);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (logs.length === 0 && userCity) {
      loadGallery(userCity);
    } else {
      setGalleryRows([]);
    }
  }, [logs.length, userCity, loadGallery]);

  if (loading && logs.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.gradientTop} pointerEvents="none" />
        <View style={styles.gradientMid} pointerEvents="none" />
        <View style={styles.gradientLowerWarm} pointerEvents="none" />
        <View style={styles.centered}>
          <ActivityIndicator color={Dawn.accent.sunrise} />
          <Text style={styles.loadingText}>Loading your mornings…</Text>
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
          title="My Mornings"
          subtitle="A chronological archive of your sunrise logs."
          hasLoggedToday={hasLoggedToday(logs)}
        />
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
          {logs.length === 0 ? (
            <>
              <Text style={styles.emptyText}>No mornings logged yet.</Text>
              {galleryRows.length > 0 && userCity ? (
                <View style={styles.gallerySection}>
                  <Text style={styles.gallerySectionTitle}>
                    Morning light across {userCity.trim()}
                  </Text>
                  <Text style={styles.gallerySectionSubtext}>
                    Some recent sunrises welcomed in your city.
                  </Text>
                  <CitySunriseGallery rows={galleryRows} limit={GALLERY_LIMIT} currentUserId={currentUserId} />
                </View>
              ) : null}
            </>
          ) : (
            logs.map((log, index) => (
              <React.Fragment key={log.id}>
                {index > 0 && (
                  <View style={styles.entryDividerWrapper}>
                    <View style={styles.entryDivider} />
                  </View>
                )}
                <View style={[styles.entry, index > 0 && styles.entrySpacer]}>
                  <Text style={styles.date}>{formatLogDate(log.created_at)}</Text>
                  {log.vantage_name ? (
                    <Text style={styles.vantageName}>{toTitleCase(log.vantage_name)}</Text>
                  ) : null}
                  {imageUrls[log.id] ? (
                    <View style={styles.imageWrapper}>
                      <Image
                        source={{ uri: imageUrls[log.id]! }}
                        style={styles.image}
                        contentFit="cover"
                      />
                    </View>
                  ) : null}
                  {log.reflection_text ? (
                    <View style={styles.reflectionSection}>
                    <Text style={styles.reflectionQuestion}>
                      {log.reflection_question_id != null &&
                      REFLECTION_QUESTION_MAP[log.reflection_question_id] != null
                        ? REFLECTION_QUESTION_MAP[log.reflection_question_id]
                        : getReflectionInvitationForDate(log.created_at)}
                    </Text>
                      <Text style={styles.reflectionText}>{capitalizeFirstForDisplay(log.reflection_text)}</Text>
                    </View>
                  ) : null}
                </View>
              </React.Fragment>
            ))
          )}
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
    marginBottom: 24,
  },
  backControl: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  backControlText: {
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  crossNavLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 14,
  },
  crossNavLinkText: {
    fontSize: 13,
    color: Dawn.text.secondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  entry: {
    marginBottom: 20,
  },
  entrySpacer: {
    marginTop: 18,
  },
  entryDividerWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 0,
  },
  entryDivider: {
    width: '70%',
    height: 1,
    backgroundColor: Dawn.border.subtle,
  },
  date: {
    fontSize: 12,
    color: Dawn.text.secondary,
    marginBottom: 10,
  },
  vantageName: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.primary,
    marginBottom: 12,
  },
  imageWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 10,
    maxHeight: 220,
  },
  reflectionSection: {
    marginTop: 4,
  },
  reflectionQuestion: {
    fontSize: 12,
    color: Dawn.text.secondary,
    marginBottom: 8,
  },
  reflectionText: {
    fontSize: 15,
    lineHeight: 22,
    color: Dawn.text.primary,
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
    marginTop: 24,
  },
  gallerySection: {
    marginTop: 32,
    marginBottom: 24,
  },
  gallerySectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 6,
  },
  gallerySectionSubtext: {
    fontSize: 13,
    color: 'rgba(231, 238, 247, 0.65)',
    marginBottom: 8,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryTile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Dawn.surface.card,
  },
  galleryTileImage: {
    width: '100%',
    height: '100%',
  },
  galleryTileDateChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  galleryTileDateText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
  },
  galleryTileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  galleryTileVantage: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSurface: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCenteredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalImageFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalIndexIndicator: {
    marginTop: 12,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  modalNavBtn: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    marginTop: -20,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalNavBtnLeft: {
    left: -8,
  },
  modalNavBtnRight: {
    right: -8,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
