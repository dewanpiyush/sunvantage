import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import StreakBlock from '../components/StreakBlock';
import SunriseLogCard, { type SunriseLogSaveResult } from '../components/SunriseLogCard';
import RitualRevealCard from '../components/RitualRevealCard';
import SharedDawnPreview from '../components/SharedDawnPreview';
import DawnInvitationSection from '../components/DawnInvitationSection';
import SunriseStateCard from '@/components/SunriseStateCard';
import { useMorningContext } from '../hooks/useMorningContext';
import { hasLoggedToday, isTodayLocal } from '../lib/hasLoggedToday';
import { computeBadgeStats, getEarnedBadges, computeEarnedAtByBadge, type BadgeDef } from './ritual-markers';
import { dismissBadgeReveal } from '../lib/ritualReveal';
import { BADGE_ICONS } from './ritual-markers';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import ScreenLayout from '@/components/ScreenLayout';
import { getTodayDawnCard, type DawnCard } from '../data/dawnCards';
import { useUIState } from '@/store/uiState';

type TodayLogDetails = {
  vantage_name: string | null;
  reflection_text: string | null;
  photo_url: string | null;
  moderation_status?: string | null;
};

const PHOTO_BUCKET = 'sunrise_photos';
const PENDING_BUCKET = 'uploads_pending';
const SIGNED_URL_EXPIRY = 60 * 60;

async function resolvePhotoDisplayUrl(photo_url: string | null | undefined, moderation_status?: string | null): Promise<string | null> {
  if (!photo_url || photo_url.startsWith('http://') || photo_url.startsWith('https://')) return photo_url ?? null;
  if (
    photo_url.startsWith('file://') ||
    photo_url.startsWith('content://') ||
    photo_url.startsWith('ph://') ||
    photo_url.startsWith('asset://')
  ) {
    return null;
  }
  const cleaned = photo_url.replace(/^\/+/, '');
  const isPendingRef = cleaned.startsWith(`${PENDING_BUCKET}/`);
  const normalized = isPendingRef
    ? cleaned.slice(`${PENDING_BUCKET}/`.length)
    : cleaned.replace(new RegExp(`^${PHOTO_BUCKET}/`), '');

  const shouldSignPending = moderation_status === 'pending' || isPendingRef;
  if (shouldSignPending) {
    const { data, error } = await supabase.storage
      .from(PENDING_BUCKET)
      .createSignedUrl(normalized, SIGNED_URL_EXPIRY);
    if (!error && data?.signedUrl) return data.signedUrl;
    return null;
  }
  const publicUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(normalized).data?.publicUrl;
  return publicUrl ?? null;
}

/** Format "HH:mm" as "h:mm AM/PM" for display. */
function formatSunriseTime(hhmm: string | null): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm ?? '—';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr!, 10);
  const m = mStr!;
  const ampm = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export default function VantageWalkScreen() {
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const { setBackgroundMode } = useUIState();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn, isMorningLight), [Dawn, isMorningLight]);
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [streakLoading, setStreakLoading] = useState(true);
  const [logs, setLogs] = useState<{ id: string | number; created_at: string }[]>([]);
  const [todayLog, setTodayLog] = useState<TodayLogDetails | null>(null);
  const [todayPhotoDisplayUrl, setTodayPhotoDisplayUrl] = useState<string | null>(null);
  const [todayPhotoError, setTodayPhotoError] = useState(false);
  const [revealBadge, setRevealBadge] = useState<BadgeDef | null>(null);
  const [walkStarted, setWalkStarted] = useState(false);
  const [showLogCard, setShowLogCard] = useState(false);
  const router = useRouter();
  const previousEarnedBadgeIdsRef = useRef<string[]>([]);
  const justSavedRef = useRef(false);

  const [dawnCard, setDawnCard] = useState<DawnCard>({
    verb: 'WITNESS',
    text: 'The sun does not carry yesterday.\nNeither do you have to.',
    completion: 'You were here.',
  });
  const [showSaved, setShowSaved] = useState(false);
  const savedOpacity = useRef(new Animated.Value(1)).current;
  const memorySettleY = useRef(new Animated.Value(0)).current;
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { sunriseToday, sunriseTomorrow, sunrisePassed } = useMorningContext(profileCity ?? null);
  const loggedToday = hasLoggedToday(logs);
  const isPostSunriseRetrospective = sunrisePassed === true && !loggedToday;

  useEffect(() => {
    setBackgroundMode(loggedToday ? 'postLog' : 'default');
  }, [loggedToday, setBackgroundMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getTodayDawnCard();
        if (!cancelled) setDawnCard(c);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    setStreakLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setProfileCity(null);
        setCurrentUserId(null);
        setStreak({ current: 0, longest: 0 });
        return;
      }
      setCurrentUserId(userId);
      const { data } = await supabase
        .from('profiles')
        .select('city, current_streak, longest_streak')
        .eq('user_id', userId)
        .maybeSingle();
      const city = data?.city != null && typeof data.city === 'string' ? data.city.trim() || null : null;
      setProfileCity(city);
      const current = typeof data?.current_streak === 'number' ? data.current_streak : typeof data?.current_streak === 'string' ? parseInt(data.current_streak, 10) : 0;
      const longest = typeof data?.longest_streak === 'number' ? data.longest_streak : typeof data?.longest_streak === 'string' ? parseInt(data.longest_streak, 10) : 0;
      setStreak({ current: Number.isNaN(current) ? 0 : current, longest: Number.isNaN(longest) ? 0 : longest });
    } catch {
      setProfileCity(null);
      setCurrentUserId(null);
      setStreak({ current: 0, longest: 0 });
    } finally {
      setStreakLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLogs([]);
        setTodayLog(null);
        return;
      }
      let result = await supabase
        .from('sunrise_logs')
        .select('created_at, vantage_name, reflection_text, photo_url, moderation_status, city')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (result.error && /column.*does not exist|city/i.test(result.error.message ?? '')) {
        result = await supabase
          .from('sunrise_logs')
          .select('created_at, vantage_name, reflection_text, photo_url, moderation_status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
      }
      const rows = (result.data ?? []) as { created_at: string; vantage_name?: string | null; reflection_text?: string | null; photo_url?: string | null; moderation_status?: string | null; city?: string | null }[];
      setLogs(rows.map((r) => ({ id: r.created_at, created_at: r.created_at })));
      const todayRow = rows.find((r) => isTodayLocal(r.created_at));
      setTodayLog(
        todayRow
          ? {
              vantage_name: todayRow.vantage_name ?? null,
              reflection_text: todayRow.reflection_text ?? null,
              photo_url: todayRow.photo_url ?? null,
              moderation_status: todayRow.moderation_status ?? null,
            }
          : null
      );
      if (rows.length > 0) {
        try {
          const stats = computeBadgeStats(rows);
          const earned = getEarnedBadges(stats);
          const earnedAtByBadge = computeEarnedAtByBadge(rows, stats);
          const previousEarnedIds = previousEarnedBadgeIdsRef.current;

          if (justSavedRef.current) {
            const newlyEarned = earned.filter((b) => !previousEarnedIds.includes(b.id));
            if (newlyEarned.length > 0) {
              const toShow = [...newlyEarned].sort((a, b) => {
                const atA = earnedAtByBadge[a.id] ?? '';
                const atB = earnedAtByBadge[b.id] ?? '';
                return atB.localeCompare(atA);
              })[0];
              setRevealBadge(toShow);
              await dismissBadgeReveal(toShow.id);
            }
            justSavedRef.current = false;
          }

          previousEarnedBadgeIdsRef.current = earned.map((b) => b.id);
        } catch {
          setRevealBadge(null);
        }
      } else {
        setRevealBadge(null);
      }
    } catch {
      setLogs([]);
      setTodayLog(null);
      setRevealBadge(null);
    }
  }, []);

  useEffect(() => {
    const ref = todayLog?.photo_url?.trim();
    if (!ref) {
      setTodayPhotoDisplayUrl(null);
      return;
    }
    let cancelled = false;
    setTodayPhotoError(false);
    resolvePhotoDisplayUrl(ref, todayLog?.moderation_status).then((url) => {
      if (!cancelled) setTodayPhotoDisplayUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [todayLog?.photo_url, todayLog?.moderation_status]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, setBackgroundMode]);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        await loadLogs();
      };
      void refresh();
    }, [loadLogs])
  );

  useEffect(() => {
    if (!showSaved) return;
    if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);

    savedFadeTimerRef.current = setTimeout(() => {
      Animated.timing(savedOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowSaved(false);
        Animated.timing(memorySettleY, {
          toValue: -6,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    }, 1800);

    return () => {
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
    };
  }, [memorySettleY, savedOpacity, showSaved]);

  const handleStartWalk = () => {
    setWalkStarted(true);
  };

  const handleOpenLogCard = () => {
    setShowLogCard(true);
  };

  const handleLogCardSaved = useCallback((_result: SunriseLogSaveResult) => {
    justSavedRef.current = true;
    setShowSaved(true);
    savedOpacity.setValue(1);
    memorySettleY.setValue(0);
    loadLogs();

    setTimeout(() => setBackgroundMode('postLog'), 300);
  }, [loadLogs, memorySettleY, savedOpacity, setBackgroundMode]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isMorningLight ? ['#EAF3FB', '#DCEAF7', '#CFE2F3'] : ['#102A43', '#1B3554', '#243F63']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <ScreenLayout
        header={
          <SunVantageHeader
            title="Vantage Hunt"
            subtitle="Walk toward somewhere new."
            hasLoggedToday={false}
            screenTitle
            onHeaderPress={() => router.push('/home')}
          />
        }
        scrollContentContainerStyle={styles.scrollContent}
      >

        {/* Streak — same as Witness, Header → 12px → Streak → 16px → Card */}
        <View style={styles.streakWrap}>
          <StreakBlock
            currentStreak={streak.current}
            longestStreak={streak.longest}
            loading={streakLoading}
            style={styles.streakBlockSpacing}
          />
        </View>

        {loggedToday && revealBadge ? (
          <RitualRevealCard
            visible={true}
            onDismiss={async () => {
              if (revealBadge) {
                await dismissBadgeReveal(revealBadge.id);
                setRevealBadge(null);
              }
            }}
            onViewMarkers={() => router.push('/ritual-markers')}
            icon={BADGE_ICONS[revealBadge.id]}
            title={revealBadge.title}
            description={revealBadge.earnedExplanation}
            ctaText="View markers"
          />
        ) : null}

        {/* Sunrise card — compressed 3-row layout (Witness/Vantage) */}
        {sunriseToday != null && (
          <SunriseStateCard
            dawnCard={dawnCard}
            hasLoggedToday={loggedToday}
            city={profileCity}
            time={formatSunriseTime(sunriseToday)}
            style={loggedToday ? styles.sunriseToMemoryGap : undefined}
          />
        )}

        {loggedToday ? (
          <Animated.View
            style={[
              styles.memoryCard,
              styles.memoryCardPostLog,
              !showSaved ? styles.memoryCardCompact : null,
              { transform: [{ translateY: memorySettleY }] },
            ]}
          >
            <View style={styles.memoryCardTop}>
              <View style={styles.titleRow}>
                <Text style={styles.titleEmoji}>🌅</Text>
                <Text style={styles.memoryCardHeader}>Your morning</Text>
              </View>
              {todayLog?.vantage_name?.trim() ? (
                <Text style={styles.memoryCardVantage}>📍 {todayLog.vantage_name.trim()}</Text>
              ) : null}
            </View>
            {todayPhotoDisplayUrl && !todayPhotoError ? (
              <View style={styles.memoryCardPhotoWrap}>
                <Image
                  source={{ uri: todayPhotoDisplayUrl }}
                  style={styles.memoryCardPhoto}
                  contentFit="cover"
                  transition={200}
                  onError={() => setTodayPhotoError(true)}
                />
              </View>
            ) : todayLog?.photo_url ? (
              <View style={styles.memoryCardPhotoPlaceholder}>
                <Text style={styles.memoryCardPhotoPlaceholderText}>Photo is still processing...</Text>
              </View>
            ) : null}

            <View style={styles.memoryCardBottom}>
              {todayLog?.reflection_text?.trim() ? (
                <Text style={styles.memoryCardReflection} numberOfLines={3}>
                  “{todayLog.reflection_text.trim()}”
                </Text>
              ) : (
                <Text style={styles.memoryCardReflectionMuted}>
                  “A word, a sentence, or just how it felt.”
                </Text>
              )}
              <View style={styles.memoryCardActionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.actionLink, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push('/witness')}
                >
                  <Text style={styles.actionLinkText}>
                    {todayLog?.reflection_text?.trim() ? 'Edit reflection' : 'Add reflection'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionLink, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push('/witness')}
                >
                  <Text style={styles.actionLinkText}>
                    {todayPhotoDisplayUrl && !todayPhotoError ? 'Change photo' : 'Add photo'}
                  </Text>
                </Pressable>
              </View>
            </View>
            {showSaved ? (
              <Animated.View style={[styles.memorySaved, { opacity: savedOpacity }]}>
                <Text style={styles.memorySavedCheck}>✓ Saved</Text>
                <Text style={styles.memorySavedCopy}>Just between you and the moment.</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : isPostSunriseRetrospective ? (
          <>
            <View style={styles.messageBlock}>
              <Text style={styles.messageLine}>Where did the light find you today?</Text>
              <Text style={styles.messageSubtext}>Even if it was just from home.</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
              onPress={handleOpenLogCard}
            >
              <Text style={styles.ctaButtonText}>Log this vantage</Text>
            </Pressable>
            <Text style={styles.vantageFooter}>Every vantage reveals the morning differently.</Text>
          </>
        ) : !walkStarted ? (
          <>
            <View style={styles.messageBlock}>
              <Text style={styles.messageLine}>Step outside.</Text>
              <Text style={styles.messageLine}>Walk slowly.</Text>
              <Text style={styles.messageLine}>Look for a place where the horizon opens.</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
              onPress={handleStartWalk}
            >
              <Text style={styles.ctaButtonText}>Start walk</Text>
            </Pressable>
            <Text style={styles.vantageFooter}>Every vantage reveals the morning differently.</Text>
          </>
        ) : (
          <>
            <Text style={styles.walkStartedTitle}>Walking toward a new vantage.</Text>
            <Text style={styles.walkStartedSub}>
              Take your time. Notice what feels like the right place.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
              onPress={handleOpenLogCard}
            >
              <Text style={styles.ctaButtonText}>Log this vantage</Text>
            </Pressable>
            <Text style={styles.vantageFooter}>Every vantage reveals the morning differently.</Text>
          </>
        )}

        {!loggedToday ? (
          <SharedDawnPreview city={profileCity} currentUserId={currentUserId} />
        ) : (
          <>
            <DawnInvitationSection
              city={profileCity}
              sunriseTomorrow={sunriseTomorrow}
            />
            <SharedDawnPreview
              city={profileCity}
              currentUserId={currentUserId}
              showEmptyState={false}
            />
          </>
        )}
      </ScreenLayout>

      <SunriseLogCard
        visible={showLogCard}
        onClose={() => setShowLogCard(false)}
        onSaved={handleLogCardSaved}
        onPlanForTomorrow={() => router.push('/tomorrow-plan')}
        city={profileCity}
        sunriseTime={sunriseToday}
        initialVantageName={null}
      />

    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>, isMorningLight: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
  },
  streakWrap: {
    marginTop: 12,
    marginBottom: 16,
  },
  streakBlockSpacing: {
    marginTop: 0,
    marginBottom: 0,
  },
  sunriseCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.sunriseCard,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  sunriseCardPostLog: {
    borderColor: 'rgba(255, 200, 120, 0.4)',
    shadowOpacity: 0.04,
  },
  sunriseCardWarmTint: {
    ...StyleSheet.absoluteFillObject,
  },
  sunriseToMemoryGap: {
    marginBottom: 24,
  },
  titleRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sunEmoji: {
    fontSize: 18,
    marginBottom: 4,
    textShadowColor: 'rgba(255, 200, 120, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  sunTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
    textAlign: 'center',
    marginBottom: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
  sunriseCardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
  },
  sunriseCardCityTime: {
    fontSize: 13,
    color: Dawn.text.secondary,
    opacity: 0.73,
    marginBottom: 0,
    textAlign: 'center',
  },
  sunriseCardTagline: {
    fontSize: 13,
    color: Dawn.text.secondary,
    opacity: 0.9,
    textAlign: 'center',
  },
  sunriseCardVerb: {
    marginTop: 13,
    fontSize: 17.5,
    lineHeight: 22,
    letterSpacing: 3.3,
    color: Dawn.text.primary,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sunriseCardCompletion: {
    marginTop: 7,
    fontSize: 13.5,
    lineHeight: 20,
    color: Dawn.text.secondary,
    opacity: 0.9,
    fontWeight: '500',
    textAlign: 'center',
  },
  messageBlock: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 16,
  },
  messageLine: {
    fontSize: 17,
    fontWeight: '400',
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  messageSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  ctaButton: {
    alignSelf: 'center',
    paddingVertical: Platform.OS === 'android' ? 12 : 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
    marginBottom: 18,
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.accent.sunriseOn,
  },
  walkStartedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Dawn.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  walkStartedSub: {
    fontSize: 15,
    color: Dawn.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  memoryCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.subtle,
    alignItems: 'center',
  },
  memoryCardPostLog: {
    borderColor: Dawn.border.sunriseCard,
    borderWidth: 1.2,
  },
  memoryCardCompact: {
    paddingBottom: 16,
    marginBottom: 12,
  },
  memoryCardTop: {
    alignItems: 'center',
    marginBottom: 12,
  },
  memoryCardHeader: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
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
  memoryCardPhotoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  memoryCardPhotoPlaceholderText: {
    fontSize: 12,
    color: Dawn.text.secondary,
  },
  memoryCardVantage: {
    fontSize: 15,
    color: Dawn.text.secondary,
    marginBottom: 0,
    textAlign: 'center',
  },
  memoryCardBottom: {
    width: '100%',
    alignItems: 'center',
  },
  memoryCardReflection: {
    fontSize: 14,
    color: isMorningLight ? Dawn.text.primary : Dawn.text.secondary,
    lineHeight: 22,
    marginBottom: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  memoryCardReflectionMuted: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 22,
    marginBottom: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  memoryCardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },
  memorySaved: {
    marginTop: 8,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Dawn.border.subtle,
    paddingTop: 8,
    paddingBottom: 2,
  },
  memorySavedCheck: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(74, 222, 128, 0.95)',
  },
  memorySavedCopy: {
    fontSize: 12,
    color: Dawn.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  actionLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: Dawn.accent.sunrise,
  },
  vantageFooter: {
    marginTop: 0,
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  });
}
