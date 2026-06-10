import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import supabase from '@/supabase';
import { hasLoggedToday } from '@/lib/hasLoggedToday';
import SunVantageHeader from '@/components/SunVantageHeader';
import StreakBlock from '@/components/StreakBlock';
import RitualRevealCard from '@/components/RitualRevealCard';
import RitualIntroCarousel from '@/components/RitualIntroCarousel';
import { useMorningContext } from '@/hooks/useMorningContext';
import { useActiveSunriseCity } from '@/hooks/useActiveSunriseCity';
import { AWAY_FROM_HOME_COPY, isAwayFromHomeCity } from '@/lib/activeSunriseCity';
import { createdAtToLocalDateString } from '@/lib/streakStats';
import { computeBadgeStats, getEarnedBadges, computeEarnedAtByBadge, BADGE_ICONS, type BadgeDef } from '@/app/ritual-markers';
import { dismissBadgeReveal, markRevealLastSeen, selectHomeRevealBadge } from '@/lib/ritualReveal';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import { runPendingModerationRecoveryDebounced } from '@/lib/pendingModerationRecovery';
import ScreenLayout from '@/components/ScreenLayout';
import { prefetchMyMornings, prefetchWorldGallery } from '@/lib/screenDataCache';
import { getTodayDawnCard, type DawnCard } from '@/data/dawnCards';
import { useUIState } from '@/store/uiState';
import SunriseStateCard from '@/components/SunriseStateCard';
import { computeStreakFromLogDates, getTodayLocalDateString, syncProfileStreakColumns } from '@/lib/streakStats';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { ROUTES } from '@/lib/routes';
import {
  formatHuntCountdown,
  getVantageHuntHomeCardCopy,
  isInVantageHuntWindow,
} from '@/lib/vantageHunt';
import {
  getSunriseCardAtmosphere,
  getSunriseCardSurfaceStyle,
} from '@/lib/sunriseCardAtmosphere';

/** Base spacing unit — home vertical rhythm (header → streak → greeting → cards). */
const SPACE = 8;

/** Bottom breathing room so content clears the floating tab dock. */
const HOME_SCROLL_BREATHING_ROOM = TAB_BAR_CLEARANCE + 24;

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
    return 'The morning will be waiting.';
  }
  return 'The morning will be waiting.';
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

/** Countdown on the sunrise card during pre-window only (no ~ approximation). */
function getPreSunriseCountdownLabel(minutesToSunrise: number | null): string | null {
  if (minutesToSunrise == null || minutesToSunrise <= 0) return null;
  if (minutesToSunrise > 60) {
    const hours = Math.max(1, Math.ceil(minutesToSunrise / 60));
    return `In ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const minutes = Math.max(1, Math.ceil(minutesToSunrise));
  return `In ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Mid-screen lead for returning users — pre uses anticipatory copy only. */
function getReturningCenterLead(sunrisePhase: SunrisePhase): string | null {
  if (sunrisePhase === 'pre') return 'The light is waiting.';
  if (sunrisePhase === 'post') return 'Did you meet the light today?';
  return 'How will you meet the light today?';
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

export default function HomeScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const { setBackgroundMode } = useUIState();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn, isMorningLight), [Dawn, isMorningLight]);
  const [profile, setProfile] = useState<{ first_name: string | null; city: string | null } | null>(null);
  const [logs, setLogs] = useState<
    {
      created_at: string;
      sunrise_day?: string | null;
      reflection_text?: string | null;
      vantage_name?: string | null;
      city?: string | null;
    }[]
  >([]);
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
  const [revealBadge, setRevealBadge] = useState<BadgeDef | null>(null);
  /** Approved photo logs in user's city from others — Explore only when enough to feel alive. */
  const [citySunrisesCount, setCitySunrisesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasOpenedBefore, setHasOpenedBefore] = useState(false);
  const [tomorrowPlan, setTomorrowPlan] = useState<{
    exists: boolean;
    place: string | null;
    alarmSet: boolean;
    alarmTime: string | null;
  }>({ exists: false, place: null, alarmSet: false, alarmTime: null });
  const lastLoadedDateRef = useRef<string | null>(null);

  const habitualCity = profile?.city ?? null;

  const { minutesToSunrise: habitualMinutesToSunrise, refresh: refreshHabitualMorning } =
    useMorningContext(habitualCity);

  const loggedToday = hasLoggedToday(logs);
  const loggedTodayCity = React.useMemo(() => {
    if (!loggedToday) return null;
    const today = getTodayLocalDateString();
    for (let i = logs.length - 1; i >= 0; i--) {
      const row = logs[i];
      const day =
        row.sunrise_day?.trim() || createdAtToLocalDateString(row.created_at);
      if (day === today && row.city?.trim()) return row.city.trim();
    }
    return null;
  }, [loggedToday, logs]);

  const { sunriseCity, isAwayFromHome, habitualCity: homeCity } = useActiveSunriseCity(habitualCity, {
    minutesToSunrise: habitualMinutesToSunrise,
    loggedTodayCity,
  });

  const {
    minutesToSunrise,
    sunriseToday,
    sunriseTomorrow,
    sunriseSource,
    cityTimezone,
    isDawnMode,
    refresh: refreshMorningContext,
  } = useMorningContext(sunriseCity);
  const cityHour = React.useMemo(() => getHourInTimeZone(cityTimezone), [cityTimezone]);
  const [minuteTick, setMinuteTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMinuteTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const minutesToSunriseFromCityClock = React.useMemo(
    () => getMinutesToSunriseFromCityClock(sunriseToday, cityTimezone),
    [sunriseToday, cityTimezone, minuteTick]
  );
  // Prefer city-clock recomputation for phase-sensitive UI edges (e.g. exact sunrise minute),
  // fallback to fetched minutes when unavailable.
  const effectiveMinutesToSunrise = minutesToSunriseFromCityClock ?? minutesToSunrise;
  const sunrisePassed = effectiveMinutesToSunrise != null && effectiveMinutesToSunrise < 0;
  const greeting = getGreeting(cityHour);
  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    let didHydrate = false;
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
        didHydrate = true;
        return;
      }
      const [profileRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('first_name, city').eq('user_id', userId).maybeSingle(),
        supabase
          .from('sunrise_logs')
          .select('created_at, sunrise_day, reflection_text, vantage_name, city')
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
        didHydrate = true;
        return;
      }
      setProfile(profileData ? { first_name, city } : null);
      const logRows = (logsRes.data ?? []) as {
        created_at: string;
        sunrise_day?: string | null;
        reflection_text?: string | null;
        vantage_name?: string | null;
        city?: string | null;
      }[];
      setLogs(logRows);
      const createdAts = logRows.map((r) => r.created_at);
      const streakResult = computeStreakFromLogDates(createdAts);
      setStreak({ current: streakResult.current, longest: streakResult.longest });
      void syncProfileStreakColumns(supabase, userId, streakResult);

      let revealToShow: BadgeDef | null = null;
      if (logRows.length > 0) {
        try {
          const stats = computeBadgeStats(logRows);
          const earned = getEarnedBadges(stats);
          const earnedAtByBadge = computeEarnedAtByBadge(logRows, stats);
          revealToShow = await selectHomeRevealBadge(earned, earnedAtByBadge);
        } catch {
          revealToShow = null;
        }
      }
      setRevealBadge(revealToShow);
      if (!revealToShow) {
        await markRevealLastSeen();
      }

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
      didHydrate = true;
    } catch {
      setProfile(null);
      setLogs([]);
      setStreak({ current: 0, longest: 0 });
      setRevealBadge(null);
      setCitySunrisesCount(0);
      didHydrate = true;
    } finally {
      if (didHydrate) {
        lastLoadedDateRef.current = getTodayLocalDateString();
      }
      setLoading(false);
    }
  }, [router]);

  const [dawnCard, setDawnCard] = useState<DawnCard>({
    verb: 'WITNESS',
    text: 'The sun does not carry yesterday.\nNeither do you have to.',
    completion: 'You were here.',
  });
  const firstName = profile?.first_name ?? null;
  const cityName = sunriseCity;
  const totalSunrises = logs.length;
  const myMorningCount = totalSunrises;
  /** Self → future → discovery: prefer archive when user has more than one log (see STEP 2 note in PR). */
  const SHOW_MY_MORNINGS = myMorningCount >= 2;
  const SHOW_CITY_CARD = citySunrisesCount > 2;
  const sunrisePhase = getSunrisePhase(effectiveMinutesToSunrise, sunrisePassed, cityHour);
  const cardAtmosphere = getSunriseCardAtmosphere(effectiveMinutesToSunrise, cityHour);
  const cardSurfaceStyle = React.useMemo(
    () => getSunriseCardSurfaceStyle(cardAtmosphere, isMorningLight),
    [cardAtmosphere, isMorningLight]
  );
  const newUserCtaCopy = React.useMemo(
    () => getNewUserLogCtaCopy(effectiveMinutesToSunrise),
    [effectiveMinutesToSunrise]
  );
  const preSunriseRelativeLabel = React.useMemo(
    () => (sunrisePhase === 'pre' ? getPreSunriseCountdownLabel(effectiveMinutesToSunrise) : null),
    [effectiveMinutesToSunrise, sunrisePhase]
  );

  const newUserPreOrLive = totalSunrises === 0 && (sunrisePhase === 'pre' || sunrisePhase === 'live');
  const newUserPostSunrise = totalSunrises === 0 && sunrisePhase === 'post';
  const newUserReturningPreOrLive =
    totalSunrises === 0 && hasOpenedBefore && (sunrisePhase === 'pre' || sunrisePhase === 'live');
  const newUserReturningPostSunrise =
    totalSunrises === 0 && hasOpenedBefore && sunrisePhase === 'post';
  const tomorrowSunriseLine = getTomorrowSunriseLine(cityName, sunriseTomorrow);

  const loggedAwayFromHome = React.useMemo(
    () =>
      Boolean(
        loggedToday &&
          homeCity &&
          loggedTodayCity &&
          isAwayFromHomeCity(homeCity, loggedTodayCity)
      ),
    [loggedToday, homeCity, loggedTodayCity]
  );

  const displayDawnCard = React.useMemo(
    () =>
      loggedAwayFromHome
        ? { ...dawnCard, completion: AWAY_FROM_HOME_COPY.postLogCompletion }
        : dawnCard,
    [dawnCard, loggedAwayFromHome]
  );

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
      const todayKey = getTodayLocalDateString();
      const firstOpenOfDay = lastLoadedDateRef.current !== todayKey;
      void loadData({ silent: !firstOpenOfDay });
      void refreshMorningContext();
      void refreshHabitualMorning();
      loadTomorrowPlan();
      runPendingModerationRecoveryDebounced(supabase);
    }, [loadData, loadTomorrowPlan, refreshMorningContext, refreshHabitualMorning])
  );

  useEffect(() => {
    let cancelled = false;
    const cityForCommunity = sunriseCity?.trim();
    if (!cityForCommunity) {
      setCitySunrisesCount(0);
      return;
    }
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;
      const { count } = await supabase
        .from('sunrise_logs')
        .select('*', { count: 'exact', head: true })
        .eq('city', cityForCommunity)
        .neq('user_id', userId)
        .not('photo_url', 'is', null)
        .eq('moderation_status', 'approved');
      if (!cancelled) setCitySunrisesCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [sunriseCity]);

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

  const isReturningForHunt = totalSunrises > 1;
  const showVantageHuntEntry =
    isReturningForHunt && !loggedToday && isInVantageHuntWindow(effectiveMinutesToSunrise);
  const vantageHuntCardCopy = React.useMemo(
    () =>
      getVantageHuntHomeCardCopy(
        sunrisePhase,
        formatSunriseTime(sunriseToday, sunriseSource),
        cityName
      ),
    [sunrisePhase, sunriseToday, sunriseSource, cityName]
  );
  const vantageHuntCountdown = React.useMemo(
    () => formatHuntCountdown(effectiveMinutesToSunrise),
    [effectiveMinutesToSunrise]
  );

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
          contentBreathingRoom={HOME_SCROLL_BREATHING_ROOM}
          enableGentleScrollWhenShort
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
            hideMenu
            showBranding
            tagline="Your quiet place to notice the morning."
            wrapperMarginBottom={0}
          />
        }
        scrollContentContainerStyle={styles.scrollContent}
        contentBreathingRoom={HOME_SCROLL_BREATHING_ROOM}
        enableGentleScrollWhenShort
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
                  : !loggedToday && isDawnMode && isAwayFromHome
                  ? (firstName
                      ? `${firstName}, ${AWAY_FROM_HOME_COPY.todayDawnAnchor}`
                      : AWAY_FROM_HOME_COPY.todayDawnAnchor)
                  : !loggedToday && isDawnMode
                  ? (firstName ? `${firstName}, you are up at dawn.` : 'You are up at dawn.')
                  : loggedToday
                    ? `${greeting}${firstName ? ` ${firstName}.` : '.'}`
                    : `${greeting}${firstName ? ` ${firstName}.` : '.'}`}
              </Text>
            </View>
            {revealBadge ? (
              <RitualRevealCard
                visible={true}
                onDismiss={async () => {
                  if (revealBadge) {
                    await dismissBadgeReveal(revealBadge.id);
                    await markRevealLastSeen();
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
            dawnCard={displayDawnCard}
            hasLoggedToday={false}
            city={cityName}
            time={formatSunriseTime(sunriseToday, sunriseSource)}
            relativeTimeLabel={preSunriseRelativeLabel}
            statusLabel={isAwayFromHome ? AWAY_FROM_HOME_COPY.sunriseCardContext : null}
            atmosphere={cardAtmosphere}
            tone={cardAtmosphere === 'live' || cardAtmosphere === 'morning' ? 'context' : 'default'}
            style={cardSurfaceStyle}
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
                dawnCard={displayDawnCard}
                hasLoggedToday={true}
                city={cityName}
                time={formatSunriseTime(sunriseToday, sunriseSource)}
                statusLabel={isAwayFromHome ? AWAY_FROM_HOME_COPY.sunriseCardContext : null}
                atmosphere={cardAtmosphere}
                tone={cardAtmosphere === 'live' || cardAtmosphere === 'morning' ? 'context' : 'default'}
                style={[cardSurfaceStyle, styles.sunriseCardInStack]}
                showSeeMorningLink={loggedToday}
                onPressSeeMorning={() => router.push('/sunrise')}
              />

              <View style={[styles.modeCard, styles.modeCardPrimary, styles.modeCardStacked]}>
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
                <Pressable
                  style={({ pressed }) => [styles.modeCardButton, pressed && styles.modeCardPressed]}
                  onPress={() => router.push('/(tabs)/tomorrow' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={tomorrowPlan.exists ? 'Review your plan' : 'Plan for tomorrow'}
                >
                  <Text style={styles.modeCardButtonText}>
                    {tomorrowPlan.exists ? 'Review your plan' : 'Plan for tomorrow'}
                  </Text>
                </Pressable>
              </View>

              {SHOW_MY_MORNINGS ? (
                <View style={[styles.modeCard, styles.modeCardYourMornings, styles.modeCardStacked]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.025)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleTertiary]}>Your mornings</Text>
                  <Text style={[styles.modeCardDesc, styles.modeCardDescTertiary]}>Revisit the sunrises you{"'"}ve welcomed.</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modeCardButton,
                      styles.modeCardButtonTertiary,
                      pressed && styles.modeCardPressed,
                    ]}
                    onPress={() => router.push('/my-mornings')}
                    accessibilityRole="button"
                    accessibilityLabel="View your mornings"
                  >
                    <Text style={[styles.modeCardButtonText, styles.modeCardButtonTextTertiary]}>View your mornings →</Text>
                  </Pressable>
                </View>
              ) : SHOW_CITY_CARD ? (
                <View style={[styles.modeCard, styles.modeCardSharedDawn, styles.modeCardStacked]}>
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleTertiary]}>Shared dawn in {cityName || 'your city'}</Text>
                  <Text style={[styles.modeCardDesc, styles.modeCardDescTertiary]}>
                    See how others in {cityName || 'your city'} are welcoming mornings on SunVantage
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modeCardButton,
                      styles.modeCardButtonTertiary,
                      pressed && styles.modeCardPressed,
                    ]}
                    onPress={() => router.push('/my-city-sunrises')}
                    accessibilityRole="button"
                    accessibilityLabel="Explore city mornings"
                  >
                    <Text style={[styles.modeCardButtonText, styles.modeCardButtonTextTertiary]}>Explore city mornings</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.modeCard, styles.modeCardSharedDawn, styles.modeCardStacked]}>
                  <Text style={[styles.modeCardTitle, styles.modeCardTitleTertiary]}>Shared dawn across the world</Text>
                  <Text style={[styles.modeCardDesc, styles.modeCardDescTertiary]}>Morning is unfolding everywhere.</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modeCardButton,
                      styles.modeCardButtonTertiary,
                      pressed && styles.modeCardPressed,
                    ]}
                    onPress={() => router.push('/world-sunrise-gallery')}
                    accessibilityRole="button"
                    accessibilityLabel="Explore global mornings"
                  >
                    <Text style={[styles.modeCardButtonText, styles.modeCardButtonTextTertiary]}>Explore global mornings →</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        ) : newUserReturningPreOrLive ? (
          /* STATE 1b — First-time user, pre/live: single primary witness action */
          <>
            {sunrisePhase === 'pre' ? (
              <Text style={[styles.centerQuestion, styles.centerQuestionHeadline]}>The light is waiting.</Text>
            ) : null}
            <View style={[styles.cardsBlock, sunrisePhase === 'live' && styles.cardsBlockLive]}>
              <View style={[styles.modeCard, styles.modeCardTightBottom]}>
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>Be there for the sunrise</Text>
                <Text style={styles.modeCardDesc}>Show up. Stand still. Welcome the day.</Text>
                <Pressable
                  style={({ pressed }) => [styles.modeCardButton, pressed && styles.modeCardPressed]}
                  onPress={handleOpenWitness}
                  accessibilityRole="button"
                  accessibilityLabel="Mark your morning"
                >
                  <Text style={styles.modeCardButtonText}>Mark your morning</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : newUserPreOrLive ? (
          /* STATE 1 — First-time user, pre/live: single primary witness action */
          <>
            <View style={styles.cardsBlock}>
              <View style={[styles.modeCard, styles.modeCardTightBottom]}>
                <Text style={styles.modeCardTitle}>Be there for the sunrise</Text>
                <Text style={styles.modeCardDesc}>Show up. Stand still. Welcome the day.</Text>
                <Pressable
                  style={({ pressed }) => [styles.modeCardButton, pressed && styles.modeCardPressed]}
                  onPress={handleOpenWitness}
                  accessibilityRole="button"
                  accessibilityLabel="Mark your morning"
                >
                  <Text style={styles.modeCardButtonText}>Mark your morning</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : newUserReturningPostSunrise || newUserPostSunrise ? (
          /* First-time user, post-sunrise: single merged card — Log for today + plan for tomorrow link */
          <>
            <Text style={[styles.centerQuestion, styles.centerQuestionHeadline, { marginTop: 28, marginBottom: 12 }]}>
              Your first sunrise moment awaits.
            </Text>
            <View style={styles.cardsBlockBeforeAction}>
              <View style={styles.modeCard}>
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>{newUserCtaCopy.title}</Text>
                <Text style={styles.modeCardDesc}>{newUserCtaCopy.subtext}</Text>
                <Pressable
                  style={({ pressed }) => [styles.modeCardButton, pressed && styles.modeCardPressed]}
                  onPress={handleOpenWitness}
                  accessibilityRole="button"
                  accessibilityLabel={newUserCtaCopy.cta}
                >
                  <Text style={styles.modeCardButtonText}>{newUserCtaCopy.cta}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.modeCardLinkWrap, pressed && styles.modeCardPressed]}
                  onPress={() => router.push('/(tabs)/tomorrow' as never)}
                  accessibilityRole="link"
                  accessibilityLabel="Plan for tomorrow"
                >
                  <Text style={styles.modeCardLink}>or plan for tomorrow</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          /* State A — Returning user, not yet logged today */
          <>
            {sunrisePhase === 'live' ? null : getReturningCenterLead(sunrisePhase) ? (
              <Text
                style={[
                  styles.centerQuestion,
                  styles.centerQuestionHeadline,
                  sunrisePhase === 'post' && styles.centerQuestionPost,
                ]}
              >
                {getReturningCenterLead(sunrisePhase)}
              </Text>
            ) : null}
            <View style={[styles.cardsBlock, sunrisePhase === 'post' && styles.cardsBlockPost]}>
              <View
                style={[
                  styles.modeCard,
                  sunrisePhase === 'pre' && styles.modeCardPreSecondary,
                  sunrisePhase === 'live' && styles.modeCardAfterSunriseLive,
                  sunrisePhase === 'live' && styles.modeCardLivePrimary,
                  sunrisePhase === 'post' && styles.modeCardAfterSunrisePost,
                  sunrisePhase === 'post' && styles.modeCardPostHero,
                  sunrisePhase !== 'live' && styles.modeCardTightBottom,
                ]}
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
                <Pressable
                  style={({ pressed }) => [
                    styles.modeCardButton,
                    sunrisePhase === 'live' && styles.modeCardButtonLivePrimary,
                    sunrisePhase === 'post' && styles.modeCardButtonPostHero,
                    pressed && styles.modeCardPressed,
                  ]}
                  onPress={handleOpenWitness}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sunrisePhase === 'pre' || sunrisePhase === 'live' ? 'Mark your morning' : 'Log for today'
                  }
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
                </Pressable>
              </View>

              {showVantageHuntEntry ? (
                <>
                  <View style={styles.orDivider}>
                    <View style={styles.orDividerLine} />
                    <Text style={styles.orDividerText}>OR</Text>
                    <View style={styles.orDividerLine} />
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modeCard,
                      sunrisePhase === 'pre' && styles.modeCardPreSecondary,
                      sunrisePhase === 'live' && styles.modeCardAfterSunriseLive,
                      sunrisePhase === 'post' && styles.modeCardAfterSunrisePost,
                      pressed && styles.modeCardPressed,
                    ]}
                    onPress={() => router.push(ROUTES.vantageHunt)}
                    accessibilityRole="button"
                    accessibilityLabel={vantageHuntCardCopy.cta}
                  >
                    <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>
                      {vantageHuntCardCopy.title}
                    </Text>
                    <Text style={styles.modeCardDesc}>{vantageHuntCardCopy.body}</Text>
                    {vantageHuntCardCopy.bodySecondary ? (
                      <Text style={styles.modeCardDesc}>{vantageHuntCardCopy.bodySecondary}</Text>
                    ) : null}
                    {vantageHuntCardCopy.meta ? (
                      <Text style={styles.modeCardDesc}>{vantageHuntCardCopy.meta}</Text>
                    ) : null}
                    {vantageHuntCardCopy.showCountdown && vantageHuntCountdown !== '—' ? (
                      <Text style={styles.modeCardDesc}>{vantageHuntCountdown}</Text>
                    ) : null}
                    <View style={styles.modeCardButton}>
                      <Text style={styles.modeCardButtonText}>{vantageHuntCardCopy.cta}</Text>
                    </View>
                    {vantageHuntCardCopy.footer ? (
                      <Text style={styles.vantageHuntFooter}>{vantageHuntCardCopy.footer}</Text>
                    ) : null}
                  </Pressable>
                </>
              ) : null}
            </View>
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
    /** Rhythm: header → first row = streak marginTop (2×SPACE); no double padding here. */
    paddingTop: 0,
    flexGrow: 1,
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
  /** “Your mornings” archive — slightly lifted for touch affordance without primary-card weight. */
  modeCardYourMornings: {
    backgroundColor: isMorningLight ? 'rgba(228, 240, 252, 0.92)' : 'rgba(24, 52, 88, 0.92)',
    borderColor: isMorningLight ? 'rgba(245, 166, 35, 0.22)' : 'rgba(255, 200, 120, 0.16)',
    borderWidth: 1,
    overflow: 'hidden',
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
  vantageHuntFooter: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: Dawn.text.secondary,
    opacity: 0.72,
    textAlign: 'center',
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
