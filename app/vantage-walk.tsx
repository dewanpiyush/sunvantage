import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import StreakBlock from '../components/StreakBlock';
import SunriseLogCard from '../components/SunriseLogCard';
import RitualRevealCard from '../components/RitualRevealCard';
import SharedDawnPreview from '../components/SharedDawnPreview';
import DawnInvitationSection from '../components/DawnInvitationSection';
import { useMorningContext } from '../hooks/useMorningContext';
import { hasLoggedToday, isTodayLocal } from '../lib/hasLoggedToday';
import { computeBadgeStats, getEarnedBadges, computeEarnedAtByBadge, type BadgeDef } from './ritual-markers';
import { dismissBadgeReveal } from '../lib/ritualReveal';
import { BADGE_ICONS } from './ritual-markers';
import { Dawn } from '../constants/theme';

type TodayLogDetails = {
  vantage_name: string | null;
  reflection_text: string | null;
  photo_url: string | null;
};

const PHOTO_BUCKET = 'sunrise_photos';
const SIGNED_URL_EXPIRY = 60 * 60;

async function resolvePhotoDisplayUrl(ref: string): Promise<string | null> {
  if (!ref?.trim()) return null;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
  const normalized = ref.replace(/^\/+/, '').replace(new RegExp(`^${PHOTO_BUCKET}/`), '');
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(normalized, SIGNED_URL_EXPIRY);
  if (!error && data?.signedUrl) return data.signedUrl;
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
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [streakLoading, setStreakLoading] = useState(true);
  const [logs, setLogs] = useState<{ created_at: string }[]>([]);
  const [todayLog, setTodayLog] = useState<TodayLogDetails | null>(null);
  const [todayPhotoDisplayUrl, setTodayPhotoDisplayUrl] = useState<string | null>(null);
  const [revealBadge, setRevealBadge] = useState<BadgeDef | null>(null);
  const [walkStarted, setWalkStarted] = useState(false);
  const [showLogCard, setShowLogCard] = useState(false);
  const router = useRouter();
  const previousEarnedBadgeIdsRef = useRef<string[]>([]);
  const justSavedRef = useRef(false);

  const { sunriseToday, sunriseTomorrow, sunriseCardTimeMessage, sunrisePassed } = useMorningContext(profileCity ?? null);
  const loggedToday = hasLoggedToday(logs);
  const isPostSunriseRetrospective = sunrisePassed === true && !loggedToday;

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
        .select('created_at, vantage_name, reflection_text, photo_url, city')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (result.error && /column.*does not exist|city/i.test(result.error.message ?? '')) {
        result = await supabase
          .from('sunrise_logs')
          .select('created_at, vantage_name, reflection_text, photo_url')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
      }
      const rows = (result.data ?? []) as { created_at: string; vantage_name?: string | null; reflection_text?: string | null; photo_url?: string | null; city?: string | null }[];
      setLogs(rows.map((r) => ({ created_at: r.created_at })));
      const todayRow = rows.find((r) => isTodayLocal(r.created_at));
      setTodayLog(
        todayRow
          ? {
              vantage_name: todayRow.vantage_name ?? null,
              reflection_text: todayRow.reflection_text ?? null,
              photo_url: todayRow.photo_url ?? null,
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
    resolvePhotoDisplayUrl(ref).then((url) => {
      if (!cancelled) setTodayPhotoDisplayUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [todayLog?.photo_url]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleStartWalk = () => {
    setWalkStarted(true);
  };

  const handleOpenLogCard = () => {
    setShowLogCard(true);
  };

  const handleLogCardSaved = useCallback(() => {
    setShowLogCard(false);
    justSavedRef.current = true;
    loadLogs();
  }, [loadLogs]);

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.gradientMid} pointerEvents="none" />
      <View style={styles.gradientLowerWarm} pointerEvents="none" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SunVantageHeader
          title="Vantage Hunt"
          subtitle="Walk toward somewhere new."
          hasLoggedToday={false}
          screenTitle
          onHeaderPress={() => router.push('/home')}
        />

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
          <View style={styles.sunriseCard}>
            <View style={styles.sunTitleRow}>
              <Text style={styles.sunEmoji}>☀️</Text>
              <Text style={styles.sunTitle}>Sunrise today</Text>
            </View>
            <Text style={styles.sunriseCardCityTime}>
              {profileCity || 'your city'} · {formatSunriseTime(sunriseToday)}
            </Text>
            <Text style={styles.sunriseCardTagline}>
              {loggedToday ? "You showed up. That's enough." : 'Earlier this morning'}
            </Text>
          </View>
        )}

        {loggedToday ? (
          <View style={styles.memoryCard}>
            <View style={styles.memoryCardTop}>
              <View style={styles.titleRow}>
                <Text style={styles.titleEmoji}>🌅</Text>
                <Text style={styles.memoryCardHeader}>Your morning</Text>
              </View>
              {todayLog?.vantage_name?.trim() ? (
                <Text style={styles.memoryCardVantage}>📍 {todayLog.vantage_name.trim()}</Text>
              ) : null}
            </View>
            {todayPhotoDisplayUrl ? (
              <View style={styles.memoryCardPhotoWrap}>
                <Image
                  source={{ uri: todayPhotoDisplayUrl }}
                  style={styles.memoryCardPhoto}
                  contentFit="cover"
                />
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
                    {todayPhotoDisplayUrl ? 'Change photo' : 'Add photo'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
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

        {!loggedToday && (
          <SharedDawnPreview city={profileCity} currentUserId={currentUserId} />
        )}

        {loggedToday && (
          <DawnInvitationSection
            city={profileCity}
            sunriseTomorrow={sunriseTomorrow}
          />
        )}
      </ScrollView>

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
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  titleRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sunTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sunEmoji: {
    fontSize: 18,
  },
  sunTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
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
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 6,
  },
  sunriseCardTagline: {
    fontSize: 13,
    color: Dawn.text.secondary,
    opacity: 0.9,
  },
  messageBlock: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 20,
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
    marginTop: 4,
    opacity: 0.9,
  },
  ctaButton: {
    alignSelf: 'center',
    paddingVertical: 14,
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
    borderColor: Dawn.border.sunriseCard,
    alignItems: 'center',
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
    color: Dawn.text.secondary,
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
