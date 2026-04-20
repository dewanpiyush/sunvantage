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

/** Base spacing unit — home vertical rhythm (header → streak → greeting → cards). */
const SPACE = 8;

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

function getHourInTimeZone(timezone: string | null): number | null {
  if (!timezone || !timezone.trim()) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '', 10);
    return Number.isNaN(hour) ? null : hour;
  } catch {
    return null;
  }
}

function getHourMinuteInTimeZone(timezone: string | null): { hour: number; minute: number } | null {
  if (!timezone || !timezone.trim()) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '', 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { hour, minute };
  } catch {
    return null;
  }
}

function getMinutesToSunriseFromCityClock(sunriseHHmm: string | null, cityTimezone: string | null): number | null {
  if (!sunriseHHmm || !/^\d{1,2}:\d{2}$/.test(sunriseHHmm)) return null;
  const now = getHourMinuteInTimeZone(cityTimezone);
  if (!now) return null;
  const [hStr, mStr] = sunriseHHmm.split(':');
  const sunriseH = parseInt(hStr!, 10);
  const sunriseM = parseInt(mStr!, 10);
  if (Number.isNaN(sunriseH) || Number.isNaN(sunriseM)) return null;
  return sunriseH * 60 + sunriseM - (now.hour * 60 + now.minute);
}

/** Time-aware greeting based on selected city timezone (morning / afternoon / evening). */
function getGreeting(cityHour: number | null): string {
  const hour = cityHour ?? 12;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Format "HH:mm" as "h:mm AM/PM" for display. */
function formatSunriseTime(hhmm: string | null, source: 'live' | 'cached' | 'fallback' | null = null): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) {
    return source === 'fallback' ? 'Around 6:00 AM' : '6:00 AM';
  }
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr!, 10);
  const m = mStr!;
  const ampm = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const human = `${h}:${m} ${ampm}`;
  return source === 'fallback' ? `Around ${human}` : human;
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

function getPreSunriseRelativeLabel(minutesToSunrise: number | null): string | null {
  if (minutesToSunrise == null || minutesToSunrise <= 0) return null;
  if (minutesToSunrise >= 60) {
    const roundedHours = Math.max(1, Math.round(minutesToSunrise / 60));
    return `In ~${roundedHours} hour${roundedHours === 1 ? '' : 's'}`;
  }
  const roundedMinutes = Math.max(5, Math.round(minutesToSunrise / 5) * 5);
  return `In ~${roundedMinutes} minutes`;
}

type SunrisePhase = 'pre' | 'live' | 'post';

function getSunrisePhase(minutesToSunrise: number | null, sunrisePassed: boolean | null, cityHour: number | null): SunrisePhase {
  if (minutesToSunrise != null) {
    if (minutesToSunrise > 20) return 'pre';
    if (minutesToSunrise >= -20) return 'live';
    return 'post';
  }
  // Fallback when timing data is briefly unavailable.
  if (sunrisePassed === true || (cityHour != null && cityHour >= 12)) return 'post';
  return 'pre';
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
  const styles = React.useMemo(() => makeStyles(Dawn, isMorningLight), [Dawn, isMorningLight]);
  const [profile, setProfile] = useState<{ first_name: string | null; city: string | null } | null>(null);
  const [logs, setLogs] = useState<{ created_at: string; reflection_text?: string | null; vantage_name?: string | null; city?: string | null }[]>([]);
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [revealBadge, setRevealBadge] = useState<BadgeDef | null>(null);
  /** Approved photo logs in user's city from others — Explore only when enough to feel alive. */
  const [citySunrisesCount, setCitySunrisesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasOpenedBefore, setHasOpenedBefore] = useState(false);
  const [showNavChevronHint, setShowNavChevronHint] = useState(false);
  const [hasManuallyOpenedNav, setHasManuallyOpenedNav] = useState(false);
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
    sunriseSource,
    cityTimezone,
    isDawnMode,
  } = useMorningContext(profile?.city ?? null);
  const cityHour = React.useMemo(() => getHourInTimeZone(cityTimezone), [cityTimezone]);
  const minutesToSunriseFromCityClock = React.useMemo(
    () => getMinutesToSunriseFromCityClock(sunriseToday, cityTimezone),
    [sunriseToday, cityTimezone]
  );
  // Prefer city-clock recomputation for phase-sensitive UI edges (e.g. exact sunrise minute),
  // fallback to fetched minutes when unavailable.
  const effectiveMinutesToSunrise = minutesToSunriseFromCityClock ?? minutesToSunrise;
  const sunrisePassed = effectiveMinutesToSunrise != null && effectiveMinutesToSunrise < 0;
  const greeting = getGreeting(cityHour);
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
        setCitySunrisesCount(0);
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
        setCitySunrisesCount(count ?? 0);
      } else {
        setCitySunrisesCount(0);
      }

      // Warm key screens without blocking current UI.
      void prefetchMyMornings(userId);
      void prefetchWorldGallery(userId);
    } catch {
      setProfile(null);
      setLogs([]);
      setStreak({ current: 0, longest: 0 });
      setRevealBadge(null);
      setCitySunrisesCount(0);
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
  const myMorningCount = totalSunrises;
  /** Self → future → discovery: prefer archive when user has more than one log (see STEP 2 note in PR). */
  const SHOW_MY_MORNINGS = myMorningCount >= 2;
  const SHOW_CITY_CARD = citySunrisesCount > 2;
  const sunrisePhase = getSunrisePhase(effectiveMinutesToSunrise, sunrisePassed, cityHour);
  const newUserCtaCopy = React.useMemo(
    () => getNewUserLogCtaCopy(effectiveMinutesToSunrise),
    [effectiveMinutesToSunrise]
  );
  const preSunriseRelativeLabel = React.useMemo(
    () => (sunrisePhase === 'pre' ? getPreSunriseRelativeLabel(effectiveMinutesToSunrise) : null),
    [effectiveMinutesToSunrise, sunrisePhase]
  );

  const newUserPreOrLive = totalSunrises === 0 && (sunrisePhase === 'pre' || sunrisePhase === 'live');
  const newUserPostSunrise = totalSunrises === 0 && sunrisePhase === 'post';
  const newUserReturningPreOrLive =
    totalSunrises === 0 && hasOpenedBefore && (sunrisePhase === 'pre' || sunrisePhase === 'live');
  const newUserReturningPostSunrise =
    totalSunrises === 0 && hasOpenedBefore && sunrisePhase === 'post';
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

  useEffect(() => {
    if (loading || loggedToday || totalSunrises > 0 || hasManuallyOpenedNav) {
      setShowNavChevronHint(false);
      return;
    }
    const timeout = setTimeout(() => {
      setShowNavChevronHint(true);
    }, 10_000);
    return () => {
      clearTimeout(timeout);
    };
  }, [loading, loggedToday, totalSunrises, hasManuallyOpenedNav]);

  const handleOpenWitness = () => {
    router.push('/witness');
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
              wrapperMarginBottom={0}
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
            hasEverLogged={logs.length > 0}
            showMyCitySunrises={citySunrisesCount > 2}
            tagline="Your quiet place to notice the morning."
            wrapperMarginBottom={0}
            highlightChevronHint={showNavChevronHint}
            onNavOpen={() => {
              setHasManuallyOpenedNav(true);
              setShowNavChevronHint(false);
            }}
          />
        }
        scrollContentContainerStyle={styles.scrollContent}
      >

        {/* New user (no sunrise logged): greeting, then ritual card (tagline is in header) */}
        {totalSunrises === 0 && (
          <>
            <View style={[styles.anchorBlock, styles.anchorBlockAfterHeader]}>
              <Text style={styles.anchorLine1}>
                {newUserPreOrLive
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
            <View style={[styles.anchorBlock, revealBadge ? styles.anchorBlockBeforeHeaderBanner : null]}>
              <Text style={[styles.anchorLine1, sunrisePhase === 'live' && styles.anchorLine1Live]}>
                {!loggedToday && sunrisePhase === 'live'
                  ? (firstName ? `${firstName}, you are here.` : 'You are here.')
                  : !loggedToday && isDawnMode
                  ? (firstName ? `${firstName}, you are up at dawn.` : 'You are up at dawn.')
                  : loggedToday
                    ? `${greeting}${firstName ? ` ${firstName}.` : '.'}`
                    : `${greeting}${firstName ? ` ${firstName}.` : '.'}`}
              </Text>
              {loggedToday ? null : sunrisePhase === 'pre' ? (
                <Text style={styles.anchorLine2}>The light is waiting.</Text>
              ) : sunrisePhase === 'live' ? (
                <Text style={styles.anchorLine2}>The show is on.</Text>
              ) : null}
            </View>
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
                variant="headerBanner"
                isLiveState={sunrisePhase === 'live'}
                containerStyle={[styles.headerBannerReveal, sunrisePhase === 'live' && styles.headerBannerRevealLive]}
              />
            ) : null}
          </>
        )}

        {/* Sunrise card — when not logged yet; after logging, “today” moves below Plan (settled state) */}
        {!loggedToday ? (
          <SunriseStateCard
            dawnCard={dawnCard}
            hasLoggedToday={false}
            city={cityName}
            time={formatSunriseTime(sunriseToday, sunriseSource)}
            relativeTimeLabel={preSunriseRelativeLabel}
            tone={sunrisePhase === 'live' || sunrisePhase === 'post' ? 'context' : 'default'}
            style={sunrisePhase === 'pre' ? styles.sunriseCardPreDominant : sunrisePhase === 'live' ? styles.sunriseCardLiveContext : undefined}
          />
        ) : null}

        {!loggedToday && sunrisePhase === 'live' ? (
          <Text style={[styles.centerQuestion, styles.centerQuestionHeadline]}>The show is on.</Text>
        ) : null}

        {loggedToday ? (
          /* State B — present → future → discovery (one tertiary card only). */
          <>
            <View style={[styles.cardsBlock, styles.cardsBlockStacked]}>
              <SunriseStateCard
                dawnCard={dawnCard}
                hasLoggedToday={true}
                city={cityName}
                time={formatSunriseTime(sunriseToday, sunriseSource)}
                style={styles.sunriseCardInStack}
                showSeeMorningLink={loggedToday}
                onPressSeeMorning={() => router.push('/sunrise')}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.modeCard,
                  styles.modeCardPrimary,
                  styles.modeCardStacked,
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

              {SHOW_MY_MORNINGS ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.modeCard,
                    styles.modeCardSharedDawn,
                    styles.modeCardStacked,
                    pressed && styles.modeCardPressed,
                  ]}
                  onPress={() => router.push('/my-mornings')}
                >
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleTertiary]}>Your mornings</Text>
                  <Text style={[styles.modeCardDesc, styles.modeCardDescTertiary]}>Revisit the sunrises you{"'"}ve welcomed.</Text>
                  <View style={[styles.modeCardButton, styles.modeCardButtonTertiary]}>
                    <Text style={[styles.modeCardButtonText, styles.modeCardButtonTextTertiary]}>View your mornings →</Text>
                  </View>
                </Pressable>
              ) : SHOW_CITY_CARD ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.modeCard,
                    styles.modeCardSharedDawn,
                    styles.modeCardStacked,
                    pressed && styles.modeCardPressed,
                  ]}
                  onPress={() => router.push('/my-city-sunrises')}
                >
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleTertiary]}>Shared dawn in {cityName || 'your city'}</Text>
                  <Text style={[styles.modeCardDesc, styles.modeCardDescTertiary]}>
                    See how others in {cityName || 'your city'} are welcoming mornings on SunVantage
                  </Text>
                  <View style={[styles.modeCardButton, styles.modeCardButtonTertiary]}>
                    <Text style={[styles.modeCardButtonText, styles.modeCardButtonTextTertiary]}>Explore city mornings</Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.modeCard,
                    styles.modeCardSharedDawn,
                    styles.modeCardStacked,
                    pressed && styles.modeCardPressed,
                  ]}
                  onPress={() => router.push('/world-sunrise-gallery')}
                >
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleTertiary]}>Shared dawn across the world</Text>
                  <Text style={[styles.modeCardDesc, styles.modeCardDescTertiary]}>Morning is unfolding everywhere.</Text>
                  <View style={[styles.modeCardButton, styles.modeCardButtonTertiary]}>
                    <Text style={[styles.modeCardButtonText, styles.modeCardButtonTextTertiary]}>Explore global mornings →</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </>
        ) : newUserReturningPreOrLive ? (
          /* STATE 1b — First-time user, pre/live: single primary witness action */
          <>
            {sunrisePhase === 'pre' ? (
              <Text style={[styles.centerQuestion, styles.centerQuestionHeadline]}>Be there when it begins.</Text>
            ) : null}
            <View style={[styles.cardsBlock, sunrisePhase === 'live' && styles.cardsBlockLive]}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, styles.modeCardTightBottom, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>Be there for the sunrise</Text>
                <Text style={styles.modeCardDesc}>Show up. Stand still. Welcome the day.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Mark your morning</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : newUserPreOrLive ? (
          /* STATE 1 — First-time user, pre/live: single primary witness action */
          <>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, styles.modeCardTightBottom, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={styles.modeCardTitle}>Be there for the sunrise</Text>
                <Text style={styles.modeCardDesc}>Show up. Stand still. Welcome the day.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Mark your morning</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : newUserReturningPostSunrise || newUserPostSunrise ? (
          /* First-time user, post-sunrise: single merged card — Log for today + plan for tomorrow link */
          <>
            <Text style={[styles.centerQuestion, styles.centerQuestionHeadline, { marginTop: 28, marginBottom: 12 }]}>
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
            {sunrisePhase === 'live' ? null : (
              <Text style={[styles.centerQuestion, styles.centerQuestionHeadline, sunrisePhase === 'post' && styles.centerQuestionPost]}>
                {sunrisePhase === 'post' ? 'Did you meet the light today?' : 'How will you meet the light today?'}
              </Text>
            )}
            <View style={[styles.cardsBlock, sunrisePhase === 'post' && styles.cardsBlockPost]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeCard,
                  sunrisePhase === 'pre' && styles.modeCardPreSecondary,
                  sunrisePhase === 'live' && styles.modeCardAfterSunriseLive,
                  sunrisePhase === 'live' && styles.modeCardLivePrimary,
                  sunrisePhase === 'post' && styles.modeCardAfterSunrisePost,
                  sunrisePhase === 'post' && styles.modeCardPostHero,
                  sunrisePhase !== 'live' && styles.modeCardTightBottom,
                  pressed && styles.modeCardPressed,
                ]}
                onPress={handleOpenWitness}
              >
                {sunrisePhase === 'live' ? (
                  <LinearGradient
                    colors={isMorningLight ? ['rgba(255,255,255,0)', 'rgba(245,166,35,0.10)'] : ['rgba(255,179,71,0.08)', 'rgba(255,179,71,0.02)']}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                ) : null}
                <Text
                  style={[
                    styles.modeCardTitle,
                    sunrisePhase !== 'live' && styles.modeCardTitleSecondary,
                    sunrisePhase === 'post' && styles.modeCardTitlePostHero,
                  ]}
                >
                  {sunrisePhase === 'post' ? 'You can still mark this morning.' : 'Be there for the sunrise'}
                </Text>
                <Text style={[styles.modeCardDesc, sunrisePhase === 'post' && styles.modeCardDescPostHero]}>
                  {sunrisePhase === 'post'
                    ? 'Even if it has passed.'
                    : sunrisePhase === 'live'
                    ? "This moment won't wait."
                    : 'Show up. Stand still. Welcome the day.'}
                </Text>
                {sunrisePhase === 'live' ? <Text style={styles.modeCardDesc}>{"You're here."}</Text> : null}
                <View
                  style={[
                    styles.modeCardButton,
                    sunrisePhase === 'live' && styles.modeCardButtonLivePrimary,
                    sunrisePhase === 'post' && styles.modeCardButtonPostHero,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeCardButtonText,
                      sunrisePhase === 'live' && styles.modeCardButtonTextLivePrimary,
                      sunrisePhase === 'post' && styles.modeCardButtonTextPostHero,
                    ]}
                  >
                    {sunrisePhase === 'pre' || sunrisePhase === 'live' ? 'Mark your morning' : 'Log for today'}
                  </Text>
                </View>
              </Pressable>

            </View>
            {sunrisePhase === 'post' ? (
              <Text style={styles.postSunriseAnchorText}>The sun returns tomorrow.</Text>
            ) : null}
          </>
        )}
      </ScreenLayout>

    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>, isMorningLight: boolean) {
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
    paddingBottom: 28,
    /** Rhythm: header → first row = streak marginTop (2×SPACE); no double padding here. */
    paddingTop: 0,
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
    /** Greeting → first card: 2×SPACE */
    marginBottom: SPACE * 2,
  },
  anchorBlockBeforeHeaderBanner: {
    marginBottom: 10,
  },
  headerBannerReveal: {
    marginBottom: 14,
  },
  headerBannerRevealLive: {
    marginBottom: 8,
  },
  /** New-user path: header → greeting = 2×SPACE (no streak row). */
  anchorBlockAfterHeader: {
    marginTop: SPACE * 2,
  },
  anchorLine1: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.secondary,
    /** Streak + greeting read as one cluster */
    marginBottom: 2,
  },
  anchorLine1Live: {
    marginBottom: 5,
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
  centerQuestionPost: {
    marginTop: 24,
    marginBottom: 28,
  },
  cardsBlockBeforeAction: {
    marginTop: 16,
  },
  /** Uniform card gaps (3×SPACE); use with modeCardStacked (no per-card marginBottom). */
  cardsBlockStacked: {
    gap: SPACE * 3,
  },
  modeCardStacked: {
    marginBottom: 0,
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
  cardsBlockLive: {
    marginTop: 12,
  },
  cardsBlockPost: {
    minHeight: 220,
  },
  orDivider: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  orDividerPostSunrise: {
    marginVertical: 16,
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
  orDividerPostSunriseLabel: {
    width: '100%',
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
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
  modeCardAfterSunriseLive: {
    marginTop: 14,
  },
  modeCardAfterSunrisePost: {
    marginTop: 0,
    marginBottom: 40,
  },
  modeCardPostHero: {
    backgroundColor: isMorningLight ? 'rgba(222, 236, 250, 0.92)' : 'rgba(19, 45, 78, 0.94)',
    borderColor: isMorningLight ? 'rgba(245, 166, 35, 0.54)' : 'rgba(255, 179, 71, 0.5)',
    borderWidth: 1.2,
    paddingVertical: 24,
  },
  modeCardSecondary: {
    backgroundColor: Dawn.surface.cardSecondary,
  },
  /** Tertiary / low emphasis — sits “back” vs Plan + Sunrise (shared city, archive). */
  modeCardSharedDawn: {
    backgroundColor: isMorningLight ? 'rgba(220, 234, 247, 0.78)' : 'rgba(20, 28, 50, 0.65)',
    borderColor: isMorningLight ? 'rgba(203, 213, 225, 0.85)' : 'rgba(42, 70, 107, 0.45)',
  },
  modeCardTitleTertiary: {
    opacity: 0.88,
  },
  modeCardDescTertiary: {
    opacity: 0.82,
  },
  modeCardButtonTertiary: {
    backgroundColor: isMorningLight ? 'rgba(245, 166, 35, 0.78)' : 'rgba(255, 179, 71, 0.72)',
  },
  modeCardButtonTextTertiary: {
    opacity: 0.95,
  },
  /** Sunrise “today” card between primary Plan and tertiary shared — medium weight. */
  sunriseCardInStack: {
    borderColor: isMorningLight ? 'rgba(245, 166, 35, 0.32)' : 'rgba(255, 179, 71, 0.35)',
  },
  sunriseCardPreDominant: {
    borderColor: isMorningLight ? 'rgba(245, 166, 35, 0.46)' : 'rgba(255, 179, 71, 0.48)',
    borderWidth: 1.2,
  },
  sunriseCardLiveContext: {
    borderColor: isMorningLight ? 'rgba(148, 170, 198, 0.28)' : 'rgba(126, 153, 186, 0.24)',
    borderWidth: 1,
    backgroundColor: isMorningLight ? 'rgba(219, 233, 247, 0.72)' : 'rgba(18, 40, 68, 0.74)',
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
  modeCardPreSecondary: {
    backgroundColor: isMorningLight ? 'rgba(220, 234, 247, 0.84)' : 'rgba(20, 41, 70, 0.82)',
    borderColor: isMorningLight ? 'rgba(203, 213, 225, 0.74)' : 'rgba(59, 90, 126, 0.52)',
  },
  modeCardLivePrimary: {
    backgroundColor: isMorningLight ? 'rgba(229, 239, 250, 0.96)' : 'rgba(24, 50, 82, 0.94)',
    borderColor: isMorningLight ? 'rgba(245, 166, 35, 0.68)' : 'rgba(255, 179, 71, 0.66)',
    borderWidth: 1.5,
    paddingVertical: 26,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  modeCardTitlePostHero: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  modeCardDesc: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 22,
    marginBottom: 4,
    textAlign: 'center',
  },
  modeCardDescPostHero: {
    opacity: 0.92,
  },
  modeCardButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
  },
  modeCardButtonPostHero: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    backgroundColor: isMorningLight ? '#F5A623' : '#FFB347',
  },
  modeCardButtonLivePrimary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: isMorningLight ? '#F6B347' : '#FFC15A',
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  modeCardButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
  },
  modeCardButtonTextPostHero: {
    fontSize: 15,
    fontWeight: '600',
  },
  modeCardButtonTextLivePrimary: {
    fontSize: 15,
    fontWeight: '600',
  },
  postSunriseAnchorText: {
    marginTop: 0,
    marginBottom: 48,
    fontSize: 13,
    lineHeight: 18,
    color: Dawn.text.secondary,
    opacity: 0.55,
    textAlign: 'center',
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
