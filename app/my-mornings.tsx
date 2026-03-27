import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import CitySunriseGallery from '../components/CitySunriseGallery';
import { hasLoggedToday } from '../lib/hasLoggedToday';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import { getMyMorningsCache, isMyMorningsCacheFresh, prefetchMyMornings } from '@/lib/screenDataCache';

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

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Local YYYY-MM-DD for comparison. */
function getLocalDateString(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Time anchor for grouping: Today, Yesterday, Earlier this week, Earlier this month, or month name. */
function getTimeAnchor(iso: string): string {
  const logDate = getLocalDateString(iso);
  if (!logDate) return '';
  const now = new Date();
  const todayStr =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr =
    `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (logDate === todayStr) return 'Today';
  if (logDate === yesterdayStr) return 'Yesterday';

  const log = new Date(iso);
  const startOfThisWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const toMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfThisWeek.setDate(now.getDate() - toMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
  const startStr = getLocalDateString(startOfThisWeek.toISOString());
  const endStr = getLocalDateString(endOfThisWeek.toISOString());

  if (logDate >= startStr && logDate <= endStr) return 'Earlier this week';

  const startOfThisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  if (logDate >= startOfThisMonth && logDate < startStr) return 'Earlier this month';

  return log.toLocaleDateString('en-US', { month: 'long' });
}

function isLogFromToday(createdAtIso: string): boolean {
  const now = new Date();
  const todayStr =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return getLocalDateString(createdAtIso) === todayStr;
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

const GALLERY_LIMIT = 10;

export default function MyMorningsScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [logs, setLogs] = useState<SunriseLogRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCity, setUserCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [galleryRows, setGalleryRows] = useState<CityGalleryRow[]>([]);

  const loadLogs = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
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
        setError('Please sign in to see your mornings.');
        setLogs([]);
        setUserCity(null);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(userId);
      const cached = await prefetchMyMornings(userId, { force: opts?.force === true });
      if (!cached) {
        setError('Could not load your mornings.');
        setLogs([]);
        return;
      }
      setLogs(cached.logs as SunriseLogRow[]);
      setUserCity(cached.userCity);
      setGalleryRows(cached.galleryRows as CityGalleryRow[]);
      setImageUrls(cached.imageUrls);
    } catch {
      setError('Something went wrong.');
      setLogs([]);
    } finally {
      if (!silent) setLoading(false);
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
        .eq('moderation_status', 'approved')
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
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        void loadLogs();
        return;
      }
      const cached = getMyMorningsCache(userId);
      if (cached) {
        setCurrentUserId(userId);
        setLogs(cached.logs as SunriseLogRow[]);
        setUserCity(cached.userCity);
        setGalleryRows(cached.galleryRows as CityGalleryRow[]);
        setImageUrls(cached.imageUrls);
        setLoading(false);
      }
      const shouldRefresh = !cached || !isMyMorningsCacheFresh(userId);
      if (shouldRefresh) {
        void loadLogs({ silent: Boolean(cached), force: true });
      }
    };
    void bootstrap();
  }, [loadLogs]);

  useEffect(() => {
    if (logs.length === 0 && userCity) {
      if (galleryRows.length === 0) {
        void loadGallery(userCity);
      }
    } else if (logs.length > 0 && galleryRows.length > 0) {
      setGalleryRows([]);
    }
  }, [logs.length, userCity, loadGallery, galleryRows.length]);

  if (loading && logs.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isMorningLight ? ['#EAF3FB', '#DCEAF7', '#CFE2F3'] : ['#102A43', '#1B3554', '#243F63']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.backgroundGradient}
          pointerEvents="none"
        />
        <View style={styles.header}>
          <SunVantageHeader
            title="My Mornings"
            subtitle="Your mornings, gathered over time."
            hasLoggedToday={false}
            screenTitle
            onHeaderPress={() => router.push('/home')}
          />
        </View>
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonAnchor} />
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineMid} />
          </View>
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLineShort} />
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineMid} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isMorningLight ? ['#EAF3FB', '#DCEAF7', '#CFE2F3'] : ['#102A43', '#1B3554', '#243F63']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <SunVantageHeader
          title="My Mornings"
          subtitle="Your mornings, gathered over time."
          hasLoggedToday={hasLoggedToday(logs)}
          screenTitle
          onHeaderPress={() => router.push('/home')}
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
            (() => {
              const groups = new Map<string, SunriseLogRow[]>();
              for (const log of logs) {
                const anchor = getTimeAnchor(log.created_at);
                if (!anchor) continue;
                const list = groups.get(anchor) ?? [];
                list.push(log);
                groups.set(anchor, list);
              }
              const fixedOrder = ['Today', 'Yesterday', 'Earlier this week', 'Earlier this month'];
              const monthAnchors = Array.from(groups.keys()).filter((a) => !fixedOrder.includes(a));
              const sortedMonthAnchors = monthAnchors.sort((a, b) => {
                const logsA = groups.get(a) ?? [];
                const logsB = groups.get(b) ?? [];
                const maxA = Math.max(...logsA.map((l) => new Date(l.created_at).getTime()));
                const maxB = Math.max(...logsB.map((l) => new Date(l.created_at).getTime()));
                return maxB - maxA;
              });
              const orderedAnchors = [...fixedOrder.filter((a) => groups.has(a)), ...sortedMonthAnchors];

              return (
                <>
                  <Text style={styles.welcomedLine}>
                    {logs.length} quiet morning{logs.length === 1 ? '' : 's'}, kept
                  </Text>
                  {orderedAnchors.map((anchor, anchorIndex) => {
                    return (
                      <View key={anchor} style={styles.anchorSection}>
                        <Text
                          style={[
                            styles.timeAnchorLabel,
                            anchorIndex === 0 && styles.timeAnchorLabelFirst,
                          ]}
                        >
                          {anchor.toUpperCase()}
                        </Text>
                        {(groups.get(anchor) ?? []).map((log) => {
                          const isEditable = isLogFromToday(log.created_at);
                          return (
                            <View key={log.id} style={styles.memoryCard}>
                              <Text style={styles.memoryCardMeta}>
                                {formatLogDate(log.created_at)}
                                {log.vantage_name?.trim()
                                  ? ` • 📍 ${toTitleCase(log.vantage_name.trim())}`
                                  : ''}
                              </Text>
                              {imageUrls[log.id] ? (
                                <View style={styles.memoryCardPhotoWrap}>
                                  <Image
                                    source={{ uri: imageUrls[log.id]! }}
                                    style={styles.memoryCardPhoto}
                                    contentFit="cover"
                                    transition={200}
                                  />
                                </View>
                              ) : null}
                              {log.reflection_text?.trim() ? (
                                <View style={styles.memoryCardBottom}>
                                  <Text style={styles.memoryCardReflection}>
                                    {capitalizeFirstForDisplay(log.reflection_text.trim())}
                                  </Text>
                                </View>
                              ) : isEditable ? (
                                <View style={styles.memoryCardBottom}>
                                  <Text style={styles.memoryCardReflectionNudge}>
                                    What stayed with you today?
                                  </Text>
                                </View>
                              ) : null}
                              {isEditable ? (
                                <View style={styles.memoryCardActionsRow}>
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.memoryCardActionLink,
                                      pressed && styles.memoryCardActionLinkPressed,
                                    ]}
                                    onPress={() => router.push('/witness')}
                                  >
                                    <Text style={styles.memoryCardActionLinkText}>
                                      {imageUrls[log.id] ? 'Change photo' : '+ Add photo'}
                                    </Text>
                                  </Pressable>
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.memoryCardActionLink,
                                      pressed && styles.memoryCardActionLinkPressed,
                                    ]}
                                    onPress={() => router.push('/witness')}
                                  >
                                    <Text style={styles.memoryCardActionLinkText}>
                                      Edit reflection
                                    </Text>
                                  </Pressable>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </>
              );
            })()
          )}
        </ScrollView>
      )}

    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
    paddingTop: 52,
  },
  /** Same full-screen gradient as Home — cards float on a continuous field */
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
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
  welcomedLine: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.secondary,
    opacity: 0.9,
    marginBottom: 16,
  },
  anchorSection: {
    marginBottom: 8,
  },
  timeAnchorLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    letterSpacing: 1.35,
    color: Dawn.text.secondary,
    marginTop: 20,
    marginBottom: 10,
  },
  timeAnchorLabelFirst: {
    marginTop: 0,
  },
  memoryCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    alignItems: 'center',
  },
  memoryCardMeta: {
    alignSelf: 'stretch',
    fontSize: 13,
    lineHeight: 18,
    color: Dawn.text.secondary,
    opacity: 0.75,
    marginBottom: 12,
  },
  memoryCardPhotoWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: Dawn.border.subtle,
  },
  memoryCardPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  memoryCardBottom: {
    width: '100%',
    alignItems: 'flex-start',
  },
  memoryCardReflection: {
    fontSize: 16,
    lineHeight: 26,
    color: Dawn.text.primary,
    textAlign: 'left',
    fontStyle: 'italic',
    opacity: 0.98,
  },
  memoryCardReflectionNudge: {
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
    textAlign: 'left',
    fontStyle: 'italic',
    opacity: 0.85,
  },
  memoryCardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 18,
    alignSelf: 'stretch',
  },
  memoryCardActionLink: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  memoryCardActionLinkPressed: {
    opacity: 0.8,
  },
  memoryCardActionLinkText: {
    fontSize: 12,
    color: Dawn.text.secondary,
    opacity: 0.65,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skeletonWrap: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  skeletonAnchor: {
    height: 14,
    width: 170,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  skeletonCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.surface.card,
  },
  skeletonImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  skeletonLineWide: {
    width: '88%',
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  skeletonLineMid: {
    width: '62%',
    height: 12,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skeletonLineShort: {
    width: '34%',
    height: 11,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
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
    color: Dawn.text.secondary,
    marginBottom: 8,
    opacity: 0.85,
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
}
