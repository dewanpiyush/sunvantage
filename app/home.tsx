import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../supabase';
import { hasLoggedToday } from '../lib/hasLoggedToday';
import SunVantageHeader from '../components/SunVantageHeader';
import StreakBlock from '../components/StreakBlock';
import RitualRevealCard from '../components/RitualRevealCard';
import RitualIntroCarousel from '../components/RitualIntroCarousel';
import { useMorningContext } from '../hooks/useMorningContext';
import { computeBadgeStats, getEarnedBadges, computeEarnedAtByBadge, BADGE_ICONS, type BadgeDef } from './ritual-markers';
import { getDismissedBadgeIds, dismissBadgeReveal } from '../lib/ritualReveal';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import { runPendingModerationRecoveryDebounced } from '@/lib/pendingModerationRecovery';
import ScreenLayout from '@/components/ScreenLayout';
import { prefetchMyMornings, prefetchWorldGallery } from '@/lib/screenDataCache';
import { getTodayDawnCard, type DawnCard } from '../data/dawnCards';
import { useUIState } from '@/store/uiState';
import SunriseStateCard from '@/components/SunriseStateCard';

// ----- Streak (same logic as elsewhere) -----
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

/** Time-aware greeting (morning / afternoon / evening). */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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

const TOMORROW_INTENTION_KEY = 'sunvantage_tomorrow_intention';
const TOMORROW_ALARM_SET_KEY = 'sunvantage_tomorrow_alarm_set';
const TOMORROW_ALARM_TIME_KEY = 'sunvantage_tomorrow_alarm_time';

/** True if place is home-like: home, room, balcony, terrace, window (case-insensitive). */
function isHomeLikePlace(place: string): boolean {
  const n = place.trim().toLowerCase();
  const homeLike = ['home', 'room', 'balcony', 'terrace', 'window'];
  return homeLike.some((w) => n === w || n.split(/\s+/).includes(w));
}

/** Subtext for "Tomorrow's plan is set" card based on place and alarm. */
function getTomorrowPlanSubtext(place: string | null, alarmSet: boolean): string {
  if (place && place.trim()) {
    if (isHomeLikePlace(place)) {
      return "Great that you're planning to wake for the sunrise.\nThe morning will meet you there.";
    }
    const trimmed = place.trim();
    return `Moving at dawn will be beautiful.\n${trimmed} awaits the morning.`;
  }
  if (alarmSet) {
    return "Your reminder is ready.\nThe morning will be waiting.";
  }
  return "Your reminder is ready.\nThe morning will be waiting.";
}

/** Ritual-first line: city + tomorrow's sunrise time (replaces weather on Home). */
function getTomorrowSunriseLine(city: string | null, sunriseTomorrow: string | null): string | null {
  if (!sunriseTomorrow || !/^\d{1,2}:\d{2}$/.test(sunriseTomorrow)) return null;
  const place = city?.trim() || 'Your city';
  return `${place} · Sunrise tomorrow: ${formatSunriseTime(sunriseTomorrow)}`;
}

function getNewUserLogCtaCopy(minutesToSunrise: number | null): { title: string; subtext: string; cta: string } {
  if (minutesToSunrise == null) {
    return {
      title: 'Were you up at sunrise today?',
      subtext: 'You can still mark it.',
      cta: 'Log for today',
    };
  }

  // A) Before sunrise (minutesToSunrise > 10)
  if (minutesToSunrise > 10) {
    return {
      title: 'Will you be there today?',
      subtext: 'You can plan to catch it.',
      cta: 'Plan for sunrise',
    };
  }

  // B) Live sunrise window (-10 to +10)
  if (minutesToSunrise >= -10 && minutesToSunrise <= 10) {
    return {
      title: 'Are you watching the sunrise?',
      subtext: 'This moment is happening now.',
      cta: 'Log this moment',
    };
  }

  // C) Dawn mode (outside live, within [-60, +30])
  if (minutesToSunrise >= -60 && minutesToSunrise <= 30) {
    return {
      title: 'Are you out this morning?',
      subtext: 'You can still mark the moment.',
      cta: 'Log for today',
    };
  }

  // D) Post sunrise (minutesToSunrise < -60)
  return {
    title: 'Were you up at sunrise today?',
    subtext: 'You can still mark it.',
    cta: 'Log for today',
  };
}

function computeStreakFromLogDates(
  createdAts: string[]
): { current: number; longest: number } {
  const validDates = createdAts
    .map(createdAtToLocalDateString)
    .filter((s): s is string => Boolean(s) && YMD_REGEX.test(s));
  if (validDates.length === 0) return { current: 0, longest: 0 };
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
  return { current, longest };
}

export default function HomeScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const { setBackgroundMode } = useUIState();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [profile, setProfile] = useState<{ first_name: string | null; city: string | null } | null>(null);
  const [logs, setLogs] = useState<{ created_at: string; reflection_text?: string | null; vantage_name?: string | null; city?: string | null }[]>([]);
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [revealBadge, setRevealBadge] = useState<BadgeDef | null>(null);
  const [showMyCitySunrises, setShowMyCitySunrises] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasOpenedBefore, setHasOpenedBefore] = useState(false);
  const [tomorrowPlan, setTomorrowPlan] = useState<{
    exists: boolean;
    place: string | null;
    alarmSet: boolean;
    alarmTime: string | null;
  }>({ exists: false, place: null, alarmSet: false, alarmTime: null });

  const {
    minutesToSunrise,
    sunriseToday,
    sunriseTomorrow,
    isDawnMode,
  } = useMorningContext(profile?.city ?? null);
  const sunrisePassed = minutesToSunrise != null && minutesToSunrise < 0;
  const isPreSunrise = minutesToSunrise != null && minutesToSunrise > 0;
  const greeting = getGreeting();
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (sessionError || !userId) {
        setProfile(null);
        setLogs([]);
        setStreak({ current: 0, longest: 0 });
        setRevealBadge(null);
        return;
      }
      const [profileRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('first_name, city').eq('user_id', userId).maybeSingle(),
        supabase
          .from('sunrise_logs')
          .select('created_at, reflection_text, vantage_name, city')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ]);
      const profileData = profileRes.data;
      const first_name =
        profileData && typeof profileData.first_name === 'string' ? profileData.first_name.trim() || null : null;
      const city =
        profileData && typeof profileData.city === 'string' ? profileData.city.trim() || null : null;
      const profileComplete = Boolean(first_name && city);
      if (userId && !profileComplete) {
        router.replace('/onboarding');
        return;
      }
      setProfile(profileData ? { first_name, city } : null);
      const logRows = (logsRes.data ?? []) as { created_at: string; reflection_text?: string | null; vantage_name?: string | null; city?: string | null }[];
      setLogs(logRows);
      const createdAts = logRows.map((r) => r.created_at);
      const streakResult = computeStreakFromLogDates(createdAts);
      setStreak(streakResult);

      const revealToShow = await (async () => {
        if (logRows.length === 0) return null;
        try {
          const stats = computeBadgeStats(logRows);
          const earned = getEarnedBadges(stats);
          if (earned.length === 0) return null;
          const earnedAtByBadge = computeEarnedAtByBadge(logRows, stats);
          const dismissed = await getDismissedBadgeIds();
          const earnedNotDismissed = earned.filter((b) => !dismissed.includes(b.id));
          const byMostRecent = <T extends { id: string }>(arr: T[]) =>
            [...arr].sort((a, b) => {
              const atA = earnedAtByBadge[a.id] ?? '';
              const atB = earnedAtByBadge[b.id] ?? '';
              return atB.localeCompare(atA);
            });
          // "Earned recently" on Home: only show an undismissed marker if it was earned in the last ~36h.
          // This keeps Home intentional (not a persistent backlog of old undisplayed markers).
          const RECENT_MS = 36 * 60 * 60 * 1000;
          const recentEarnedNotDismissed = earnedNotDismissed.filter((b) => {
            const at = earnedAtByBadge[b.id];
            if (!at) return false;
            const t = new Date(at).getTime();
            if (Number.isNaN(t)) return false;
            return Date.now() - t <= RECENT_MS;
          });
          if (recentEarnedNotDismissed.length > 0) {
            return byMostRecent(recentEarnedNotDismissed)[0];
          }
          if (streakResult.current === 0) {
            return byMostRecent(earned)[0];
          }
          return null;
        } catch {
          return null;
        }
      })();
      setRevealBadge(revealToShow);

      if (city) {
        const { count } = await supabase
          .from('sunrise_logs')
          .select('*', { count: 'exact', head: true })
          .eq('city', city)
          .neq('user_id', userId)
          .not('photo_url', 'is', null)
          .eq('moderation_status', 'approved');
        setShowMyCitySunrises((count ?? 0) > 1);
      } else {
        setShowMyCitySunrises(false);
      }

      // Warm key screens without blocking current UI.
      void prefetchMyMornings(userId);
      void prefetchWorldGallery(userId);
    } catch {
      setProfile(null);
      setLogs([]);
      setStreak({ current: 0, longest: 0 });
      setRevealBadge(null);
      setShowMyCitySunrises(false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loggedToday = hasLoggedToday(logs);
  const [dawnCard, setDawnCard] = useState<DawnCard>({
    verb: 'WITNESS',
    text: 'The sun does not carry yesterday.\nNeither do you have to.',
    completion: 'You were here.',
  });
  const firstName = profile?.first_name ?? null;
  const cityName = profile?.city ?? null;
  const totalSunrises = logs.length;
  const showSunriseContextCard = sunrisePassed && !loggedToday;
  const newUserCtaCopy = React.useMemo(() => getNewUserLogCtaCopy(minutesToSunrise), [minutesToSunrise]);

  const newUserPreSunrise = totalSunrises === 0 && minutesToSunrise != null && minutesToSunrise > 0;
  const newUserPostSunrise = totalSunrises === 0 && (minutesToSunrise == null || minutesToSunrise <= 0);
  const newUserReturningPreSunrise =
    totalSunrises === 0 && hasOpenedBefore && minutesToSunrise != null && minutesToSunrise > 0;
  const newUserReturningPostSunrise =
    totalSunrises === 0 && hasOpenedBefore && (minutesToSunrise == null || minutesToSunrise <= 0);
  const tomorrowSunriseLine = getTomorrowSunriseLine(cityName, sunriseTomorrow);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const loadTomorrowPlan = useCallback(async () => {
    try {
      const [intention, alarmSet, alarmTime] = await Promise.all([
        AsyncStorage.getItem(TOMORROW_INTENTION_KEY),
        AsyncStorage.getItem(TOMORROW_ALARM_SET_KEY),
        AsyncStorage.getItem(TOMORROW_ALARM_TIME_KEY),
      ]);
      const place = intention?.trim() || null;
      const hasAlarm = alarmSet === '1';
      setTomorrowPlan({
        exists: Boolean(place) || hasAlarm,
        place,
        alarmSet: hasAlarm,
        alarmTime: alarmTime?.trim() || null,
      });
    } catch {
      setTomorrowPlan({ exists: false, place: null, alarmSet: false, alarmTime: null });
    }
  }, []);

  useEffect(() => {
    loadTomorrowPlan();
  }, [loadTomorrowPlan]);

  useFocusEffect(
    useCallback(() => {
      loadTomorrowPlan();
      runPendingModerationRecoveryDebounced(supabase);
    }, [loadTomorrowPlan])
  );

  useEffect(() => {
    const key = 'sunvantage_has_opened_before';
    (async () => {
      try {
        const value = await AsyncStorage.getItem(key);
        setHasOpenedBefore(value === 'true');
      } catch {
        setHasOpenedBefore(false);
      }
      try {
        await AsyncStorage.setItem(key, 'true');
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleOpenWitness = () => {
    router.push('/witness');
  };

  const handleExplorer = () => {
    router.push('/vantage-walk');
  };

  if (loading) {
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
              hasLoggedToday={false}
              showMyCitySunrises={false}
              tagline="Your quiet place to notice the morning."
              wrapperMarginBottom={9}
            />
          }
          scrollContentContainerStyle={styles.scrollContent}
        >
          <View style={styles.skeletonLineHomeWide} />
          <View style={styles.skeletonLineHomeMid} />
          <View style={styles.skeletonHomeCard}>
            <View style={styles.skeletonLineHomeShort} />
            <View style={styles.skeletonLineHomeWide} />
            <View style={styles.skeletonLineHomeMid} />
          </View>
          <View style={styles.skeletonHomeCard}>
            <View style={styles.skeletonLineHomeShort} />
            <View style={styles.skeletonLineHomeWide} />
            <View style={styles.skeletonLineHomeMid} />
          </View>
        </ScreenLayout>
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

      <ScreenLayout
        header={
          <SunVantageHeader
            hasLoggedToday={loggedToday}
            showMyCitySunrises={showMyCitySunrises}
            tagline="Your quiet place to notice the morning."
            wrapperMarginBottom={9}
          />
        }
        scrollContentContainerStyle={styles.scrollContent}
      >

        {/* New user (no sunrise logged): greeting, then ritual card (tagline is in header) */}
        {totalSunrises === 0 && (
          <>
            <View style={styles.anchorBlock}>
              <Text style={styles.anchorLine1}>
                {newUserPreSunrise
                  ? (firstName ? `Good morning ${firstName}.` : 'Good morning.')
                  : (firstName ? `${greeting} ${firstName}.` : `${greeting}.`)}
              </Text>
            </View>
            <RitualIntroCarousel />
          </>
        )}

        {/* Returning user: streak, reveal, then greeting (tagline is in header when nav is shown) */}
        {totalSunrises > 0 && (
          <>
            <StreakBlock
              currentStreak={streak.current}
              longestStreak={streak.longest}
              loading={loading}
              hideLongestWhenFirst={totalSunrises === 1}
            />
            {revealBadge ? (
              <RitualRevealCard
                visible={true}
                onDismiss={async () => {
                  if (revealBadge) {
                    await dismissBadgeReveal(revealBadge.id);
                    setRevealBadge(null);
                  }
                }}
                onViewMarkers={() => router.push('/ritual-markers')}
                showCta={false}
                icon={BADGE_ICONS[revealBadge.id]}
                title={revealBadge.title}
                description={revealBadge.earnedExplanation}
                ctaText="View markers"
              />
            ) : null}
            <View style={styles.anchorBlock}>
              <Text style={styles.anchorLine1}>
                {!loggedToday && isDawnMode
                  ? (firstName ? `${firstName}, you are up at dawn.` : 'You are up at dawn.')
                  : loggedToday
                    ? `${greeting}${firstName ? ` ${firstName}.` : '.'}`
                    : `${greeting}${firstName ? ` ${firstName}.` : '.'}`}
              </Text>
              {loggedToday ? null : minutesToSunrise != null && minutesToSunrise >= 0 ? (
                <Text style={styles.anchorLine2}>The sun will rise in {minutesToSunrise} minutes.</Text>
              ) : showSunriseContextCard ? null : (
                <Text style={styles.anchorLine2}>The light is waiting.</Text>
              )}
            </View>
          </>
        )}

        {/* Sunrise card — when not logged yet; after logging, “today” moves below Plan (settled state) */}
        {!loggedToday ? (
          <SunriseStateCard
            dawnCard={dawnCard}
            hasLoggedToday={false}
            city={cityName}
            time={formatSunriseTime(sunriseToday)}
          />
        ) : null}

        {loggedToday ? (
          /* State B — After sunrise logged: Plan first (primary), then today settled, then archive */
          <>
            <View style={[styles.cardsBlock, totalSunrises === 1 && styles.cardsBlockFirstSunriseLogged]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeCard,
                  styles.modeCardPrimary,
                  totalSunrises === 1 && styles.modeCardFirstSunriseLoggedGap,
                  pressed && styles.modeCardPressed,
                ]}
                onPress={() => router.push('/tomorrow-plan')}
              >
                <Text style={styles.modeCardTitle}>
                  {tomorrowPlan.exists ? "Tomorrow's plan is set" : 'Dawn is always beautiful.'}
                </Text>
                {tomorrowPlan.exists && tomorrowPlan.alarmTime != null ? (
                  <>
                    <Text style={styles.modeCardDesc}>Reminder set for {tomorrowPlan.alarmTime}.</Text>
                    <Text style={styles.modeCardDesc}>
                      {getTomorrowPlanSubtext(tomorrowPlan.place, tomorrowPlan.alarmSet)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.modeCardDesc}>
                    {tomorrowPlan.exists
                      ? getTomorrowPlanSubtext(tomorrowPlan.place, tomorrowPlan.alarmSet)
                      : 'It reveals differently from different vantages.'}
                  </Text>
                )}
                {!tomorrowPlan.exists && tomorrowSunriseLine ? (
                  <Text style={styles.modeCardDesc}>{tomorrowSunriseLine}</Text>
                ) : null}
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>
                    {tomorrowPlan.exists ? 'Review your plan' : 'Plan for tomorrow'}
                  </Text>
                </View>
              </Pressable>

              <SunriseStateCard
                dawnCard={dawnCard}
                hasLoggedToday={true}
                city={cityName}
                time={formatSunriseTime(sunriseToday)}
              />

              {totalSunrises === 1 ? (
                <Pressable
                  style={({ pressed }) => [styles.modeCard, styles.modeCardSecondary, pressed && styles.modeCardPressed]}
                  onPress={() => router.push('/my-city-sunrises')}
                >
                  <Text style={styles.modeCardTitle}>Shared dawn in {cityName || 'your city'}</Text>
                  <Text style={styles.modeCardDesc}>
                    See how others in {cityName || 'your city'} are welcoming mornings on SunVantage
                  </Text>
                  <View style={styles.modeCardButton}>
                    <Text style={styles.modeCardButtonText}>Explore city mornings</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.modeCard, styles.modeCardSecondary, pressed && styles.modeCardPressed]}
                  onPress={() => router.push('/my-mornings')}
                >
                  <Text style={styles.modeCardTitle}>View your mornings</Text>
                  <Text style={styles.modeCardDesc}>Revisit the sunrises you{"'"}ve welcomed.</Text>
                  <View style={styles.modeCardButton}>
                    <Text style={styles.modeCardButtonText}>Open My Mornings</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </>
        ) : newUserReturningPreSunrise ? (
          /* STATE 1b — First-time user, pre-sunrise: Witness + Plan for tomorrow */
          <>
            <Text style={[styles.centerQuestion, styles.centerQuestionHeadline]}>Today could be your first sunrise here.</Text>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, styles.modeCardTightBottom, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>Witness the sunrise</Text>
                <Text style={styles.modeCardDesc}>Show up. Stand still. Welcome the day.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Open witness</Text>
                </View>
              </Pressable>
              <View style={styles.orDivider}>
                <View style={styles.orDividerLine} />
                <Text style={styles.orDividerText}>OR</Text>
                <View style={styles.orDividerLine} />
              </View>
              <Pressable
                style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
                onPress={() => router.push('/tomorrow-plan')}
              >
                <View style={styles.titleRowCentered}>
                  <Text style={styles.titleEmoji}>🌅</Text>
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>Welcome the first light tomorrow</Text>
                </View>
                <Text style={styles.modeCardDesc}>Tomorrow brings another sunrise.</Text>
                <Text style={styles.modeCardDesc}>Choose a moment to step outside and notice it.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Plan for tomorrow</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : newUserPreSunrise ? (
          /* STATE 1 — First-time user, pre-sunrise: Witness + Plan for tomorrow */
          <>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, styles.modeCardTightBottom, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={styles.modeCardTitle}>Witness the sunrise</Text>
                <Text style={styles.modeCardDesc}>Show up. Stand still. Welcome the day.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Open witness</Text>
                </View>
              </Pressable>
              <View style={styles.orDivider}>
                <View style={styles.orDividerLine} />
                <Text style={styles.orDividerText}>OR</Text>
                <View style={styles.orDividerLine} />
              </View>
              <Pressable
                style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
                onPress={() => router.push('/tomorrow-plan')}
              >
                <View style={styles.titleRowCentered}>
                  <Text style={styles.titleEmoji}>🌅</Text>
                  <Text style={styles.modeCardTitle}>Welcome the first light tomorrow</Text>
                </View>
                <Text style={styles.modeCardDesc}>Tomorrow brings another sunrise.</Text>
                <Text style={styles.modeCardDesc}>Choose a moment to step outside and notice it.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Plan for tomorrow</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : newUserReturningPostSunrise || newUserPostSunrise ? (
          /* First-time user, post-sunrise: single merged card — Log for today + plan for tomorrow link */
          <>
            <Text style={[styles.centerQuestion, styles.centerQuestionHeadline, { marginTop: 0, marginBottom: 12 }]}>
              Your first sunrise moment awaits.
            </Text>
            <View style={styles.cardsBlockBeforeAction}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>{newUserCtaCopy.title}</Text>
                <Text style={styles.modeCardDesc}>{newUserCtaCopy.subtext}</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>{newUserCtaCopy.cta}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.modeCardLinkWrap, pressed && styles.modeCardPressed]}
                  onPress={() => router.push('/tomorrow-plan')}
                >
                  <Text style={styles.modeCardLink}>or plan for tomorrow</Text>
                </Pressable>
              </Pressable>
            </View>
          </>
        ) : (
          /* State A — Returning user, not yet logged today */
          <>
            <Text style={[styles.centerQuestion, (showSunriseContextCard || isPreSunrise) && styles.centerQuestionHeadline]}>
              {showSunriseContextCard ? 'Met the first light today?' : 'How will you meet the light today?'}
            </Text>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeCard,
                  (showSunriseContextCard || isPreSunrise) && styles.modeCardTightBottom,
                  pressed && styles.modeCardPressed,
                ]}
                onPress={handleOpenWitness}
              >
                <Text style={[styles.modeCardTitle, (showSunriseContextCard || isPreSunrise) && styles.modeCardTitleSecondary]}>
                  {showSunriseContextCard ? 'Did you?' : 'Witness the sunrise'}
                </Text>
                <Text style={styles.modeCardDesc}>
                  {showSunriseContextCard
                    ? 'Show up. Stand still, and welcome the day?'
                    : 'Show up. Stand still. Welcome the day.'}
                </Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>
                    {showSunriseContextCard ? 'Log for today' : 'Open witness'}
                  </Text>
                </View>
              </Pressable>

              {(showSunriseContextCard || isPreSunrise) && (
                <View style={styles.orDivider}>
                  <View style={styles.orDividerLine} />
                  <Text style={styles.orDividerText}>OR</Text>
                  <View style={styles.orDividerLine} />
                </View>
              )}

              <Pressable
                style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
                onPress={handleExplorer}
              >
                <Text style={[styles.modeCardTitle, (showSunriseContextCard || isPreSunrise) && styles.modeCardTitleSecondary]}>
                  {showSunriseContextCard ? 'Find a new vantage?' : 'Find a new vantage'}
                </Text>
                <Text style={styles.modeCardDesc}>
                  {showSunriseContextCard
                    ? 'If you stepped out at dawn'
                    : 'Step out before dawn.'}
                </Text>
                <Text style={styles.modeCardDesc}>
                  {showSunriseContextCard
                    ? 'and walked somewhere new.'
                    : 'Walk toward somewhere new.'}
                </Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>
                    {showSunriseContextCard ? 'Log a vantage you discovered' : 'Begin a vantage walk'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
        )}
      </ScreenLayout>

    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  titleRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sunriseCardHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sunEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  sunTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  titleEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
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
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  tagline: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  ritualIntroCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.soft,
  },
  ritualIntroCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ritualIntroCardEmoji: {
    fontSize: 20,
  },
  ritualIntroCardTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
    color: Dawn.text.primary,
    textAlign: 'center',
  },
  cardBodyLine: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  cardBodyLineSecond: {
    marginTop: 6,
  },
  anchorBlock: {
    marginBottom: 24,
  },
  anchorLine1: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.secondary,
    marginBottom: 4,
  },
  anchorLine2: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginTop: 6,
  },
  sunriseContextCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 22,
    padding: 16,
    marginTop: 0,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.subtle,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sunriseContextCardPostSunrise: {
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.subtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  /** Logged-in home: “today” card — softer, no glow (Plan holds primary focus) */
  sunriseContextCardSettled: {
    backgroundColor: Dawn.surface.cardSecondary,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.subtle,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sunriseContextCardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  sunriseContextCardBody: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 5,
  },
  sunriseContextCardSub: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  sunriseContextCardButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
  },
  sunriseContextCardButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
  },
  centerQuestion: {
    fontSize: 17,
    fontWeight: '500',
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  centerQuestionHeadline: {
    fontSize: 21,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginTop: 24,
    marginBottom: 16,
  },
  cardsBlockBeforeAction: {
    marginTop: 16,
  },
  cardsBlockFirstSunriseLogged: {
    marginTop: 0,
  },
  modeCardFirstSunriseLoggedGap: {
    marginBottom: 24,
  },
  modeCardLinkWrap: {
    marginTop: 12,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCardLink: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  centerMessage: {
    fontSize: 17,
    fontWeight: '500',
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardsBlock: {},
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Dawn.border.subtle,
    marginHorizontal: 12,
  },
  orDividerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  modeCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.subtle,
  },
  modeCardSecondary: {
    backgroundColor: Dawn.surface.cardSecondary,
  },
  /** After logging: “Plan for tomorrow” is the primary card (glow + contrast) */
  modeCardPrimary: {
    backgroundColor: Dawn.surface.cardPrimary,
    borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.sunriseCard,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  modeCardTightBottom: {
    marginBottom: 6,
  },
  modeCardPressed: {
    opacity: 0.92,
  },
  modeCardTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modeCardTitleSecondary: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    color: Dawn.text.primary,
  },
  modeCardDesc: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 22,
    marginBottom: 4,
    textAlign: 'center',
  },
  modeCardButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
  },
  modeCardButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
  },
  skeletonHomeCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  skeletonLineHomeWide: {
    width: '88%',
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  skeletonLineHomeMid: {
    width: '64%',
    height: 12,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  skeletonLineHomeShort: {
    width: '38%',
    height: 11,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  });
}
