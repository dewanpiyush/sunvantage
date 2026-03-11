import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../supabase';
import { hasLoggedToday } from '../lib/hasLoggedToday';
import SunVantageHeader from '../components/SunVantageHeader';
import StreakBlock from '../components/StreakBlock';
import RitualRevealCard from '../components/RitualRevealCard';
import { useMorningContext } from '../hooks/useMorningContext';
import { computeBadgeStats, getEarnedBadges, computeEarnedAtByBadge, BADGE_ICONS, type BadgeDef } from './ritual-markers';
import { getDismissedBadgeIds, dismissBadgeReveal } from '../lib/ritualReveal';
import { Dawn } from '../constants/theme';

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

/** Time-aware sunrise glow alpha. minutesToSunrise = minutes until sunrise (negative after). */
function getSunriseGlowAlpha(minutesToSunrise: number | null): number {
  if (minutesToSunrise == null) return 0.04;
  const minutesFromSunrise = -minutesToSunrise;
  if (minutesFromSunrise < -60) return 0;
  if (minutesFromSunrise < -10) return 0.06;
  if (minutesFromSunrise <= 10) return 0.16;
  if (minutesFromSunrise <= 60) return 0.10;
  return 0.04;
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

/** Weather line for tomorrow morning from morning context. */
function getTomorrowWeatherLine(weather: string | null): string | null {
  if (!weather || weather === 'unknown') return null;
  const lines: Record<string, string> = {
    clear: 'Tomorrow morning may be clear.',
    cloudy: 'Tomorrow morning may be cloudy.',
    rain: 'Tomorrow morning may be rainy.',
    storm: 'Tomorrow morning may be stormy.',
  };
  return lines[weather] ?? null;
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

  const { minutesToSunrise, sunriseToday, tomorrowWeather, isDawnMode, sunriseCardTimeMessage } = useMorningContext(profile?.city ?? null);
  const sunrisePassed = minutesToSunrise != null && minutesToSunrise < 0;
  const isPreSunrise = minutesToSunrise != null && minutesToSunrise > 0;
  const greeting = getGreeting();
  const sunriseGlowAlpha = getSunriseGlowAlpha(minutesToSunrise);

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
          .not('photo_url', 'is', null);
        setShowMyCitySunrises((count ?? 0) > 1);
      } else {
        setShowMyCitySunrises(false);
      }
    } catch {
      setProfile(null);
      setLogs([]);
      setStreak({ current: 0, longest: 0 });
      setRevealBadge(null);
      setShowMyCitySunrises(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loggedToday = hasLoggedToday(logs);
  const firstName = profile?.first_name ?? null;
  const cityName = profile?.city ?? null;
  const totalSunrises = logs.length;
  const isFirstSunrise = totalSunrises === 0;
  const showSunriseContextCard = sunrisePassed && !loggedToday;

  const newUserPreSunrise = totalSunrises === 0 && minutesToSunrise != null && minutesToSunrise > 0;
  const newUserPostSunrise = totalSunrises === 0 && (minutesToSunrise == null || minutesToSunrise <= 0);
  const newUserReturningPreSunrise =
    totalSunrises === 0 && hasOpenedBefore && minutesToSunrise != null && minutesToSunrise > 0;
  const newUserReturningPostSunrise =
    totalSunrises === 0 && hasOpenedBefore && (minutesToSunrise == null || minutesToSunrise <= 0);
  const tomorrowWeatherLine = getTomorrowWeatherLine(tomorrowWeather);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.gradientMid} pointerEvents="none" />
      <View
        style={[styles.gradientLowerWarm, { backgroundColor: `rgba(255,179,71,${sunriseGlowAlpha})` }]}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SunVantageHeader hasLoggedToday={loggedToday} showMyCitySunrises={showMyCitySunrises} />
        <Text style={styles.tagline}>
          Your quiet place to notice the morning.
        </Text>

        {/* Ritual Introduction Card — first-time users only */}
        {totalSunrises === 0 && (
          <View style={styles.ritualIntroCard}>
            <Text style={styles.ritualIntroCardTitle}>🌅 A simple morning ritual</Text>
            <Text style={styles.ritualIntroCardBody}>Step outside.</Text>
            <Text style={styles.ritualIntroCardBody}>Notice the sunrise.</Text>
            <Text style={styles.ritualIntroCardBody}>Mark the moment here.</Text>
            <Text style={styles.ritualIntroCardSupport}>Photos are optional.{'\n'}Showing up counts.</Text>
          </View>
        )}

        {totalSunrises > 0 && (
          <StreakBlock
            currentStreak={streak.current}
            longestStreak={streak.longest}
            loading={loading}
          />
        )}

        {totalSunrises > 0 && revealBadge ? (
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

        {/* Time-aware greeting */}
        <View style={styles.anchorBlock}>
          <Text style={styles.anchorLine1}>
            {!loggedToday && isDawnMode
              ? (firstName ? `${firstName}, you are up at dawn.` : 'You are up at dawn.')
              : loggedToday
                ? `${greeting}${firstName ? ` ${firstName}.` : '.'}`
                : newUserPreSunrise
                  ? (firstName ? `Good morning ${firstName}.` : 'Good morning.')
                  : newUserPostSunrise
                    ? (firstName ? `${greeting} ${firstName}.` : `${greeting}.`)
                    : `${greeting}${firstName ? ` ${firstName}.` : '.'}`}
          </Text>
          {newUserPreSunrise || newUserPostSunrise ? null : loggedToday ? null : minutesToSunrise != null && minutesToSunrise >= 0 ? (
            <Text style={styles.anchorLine2}>
              The sun will rise in {minutesToSunrise} minutes.
            </Text>
          ) : showSunriseContextCard ? null : (
            <Text style={styles.anchorLine2}>The light is waiting.</Text>
          )}
        </View>

        {/* Sunrise card — always shown; copy adapts by timing and logged state */}
        <View style={styles.sunriseContextCard}>
          <Text style={styles.sunriseContextCardTitle}>☀ Sunrise today</Text>
          {minutesToSunrise != null && minutesToSunrise > 10 ? (
            <>
              <Text style={styles.sunriseContextCardBody}>
                Sunrise in {cityName || 'your city'} will be at {formatSunriseTime(sunriseToday)}.
              </Text>
              <Text style={styles.sunriseContextCardSub}>
                {sunriseCardTimeMessage ?? 'The morning is on its way.'}
              </Text>
            </>
          ) : minutesToSunrise != null && minutesToSunrise >= -10 && minutesToSunrise <= 10 ? (
            <>
              <Text style={styles.sunriseContextCardBody}>
                Sunrise in {cityName || 'your city'} will be at {formatSunriseTime(sunriseToday)}.
              </Text>
              <Text style={styles.sunriseContextCardSub}>The show is on. Step outside.</Text>
            </>
          ) : sunrisePassed && !loggedToday ? (
            <>
              <Text style={styles.sunriseContextCardBody}>
                Sunrise in {cityName || 'your city'} was at {formatSunriseTime(sunriseToday)}. You can still mark the moment.
              </Text>
            </>
          ) : loggedToday ? (
            <>
              <Text style={styles.sunriseContextCardBody}>
                Sunrise in {cityName || 'your city'} was at {formatSunriseTime(sunriseToday)}.
              </Text>
              <Text style={styles.sunriseContextCardSub}>You welcomed the morning.</Text>
              <Pressable
                style={({ pressed }) => [styles.sunriseContextCardButton, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={styles.sunriseContextCardButtonText}>Today's sunrise</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sunriseContextCardBody}>
                Sunrise in {cityName || 'your city'} will be at {formatSunriseTime(sunriseToday)}.
              </Text>
              <Text style={styles.sunriseContextCardSub}>
                {sunriseCardTimeMessage ?? 'The morning is on its way.'}
              </Text>
            </>
          )}
        </View>

        {loggedToday ? (
          /* State B — After sunrise logged */
          <>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
                onPress={() => router.push('/tomorrow-plan')}
              >
                <Text style={styles.modeCardTitle}>
                  {tomorrowPlan.exists ? "Tomorrow's plan is set" : 'Moving at dawn could be beautiful.'}
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
                      : 'The same sunrise reveals differently from different vantages.'}
                  </Text>
                )}
                {!tomorrowPlan.exists && tomorrowWeatherLine && (
                  <Text style={styles.modeCardDesc}>{tomorrowWeatherLine}</Text>
                )}
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>
                    {tomorrowPlan.exists ? 'Review your plan' : 'Plan for tomorrow'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
                onPress={() => router.push('/my-mornings')}
              >
                <Text style={styles.modeCardTitle}>View your mornings</Text>
                <Text style={styles.modeCardDesc}>Revisit the sunrises you've welcomed.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Open My Mornings</Text>
                </View>
              </Pressable>
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
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>🌅 Welcome the first light tomorrow</Text>
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
                <Text style={styles.modeCardTitle}>🌅 Welcome the first light tomorrow</Text>
                <Text style={styles.modeCardDesc}>Tomorrow brings another sunrise.</Text>
                <Text style={styles.modeCardDesc}>Choose a moment to step outside and notice it.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Plan for tomorrow</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : newUserReturningPostSunrise ? (
          /* STATE 2b — First-time user, post-sunrise: Log for today + Plan for tomorrow */
          <>
            <Text style={[styles.centerQuestion, styles.centerQuestionHeadline]}>Your first sunrise moment is waiting.</Text>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, styles.modeCardTightBottom, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>Ready to log it?</Text>
                <Text style={styles.modeCardDesc}>If you showed up, stood still,</Text>
                <Text style={styles.modeCardDesc}>and welcomed the day today.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Log for today</Text>
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
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>🌅 Welcome the first light tomorrow</Text>
                <Text style={styles.modeCardDesc}>Tomorrow brings another sunrise.</Text>
                <Text style={styles.modeCardDesc}>Choose a moment to step outside and notice it.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Plan for tomorrow</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : newUserPostSunrise ? (
          /* STATE 2 — First-time user, post-sunrise: Log for today + Plan for tomorrow */
          <>
            <Text style={[styles.centerQuestion, styles.centerQuestionHeadline]}>Your first sunrise moment is waiting.</Text>
            <View style={styles.cardsBlock}>
              <Pressable
                style={({ pressed }) => [styles.modeCard, styles.modeCardTightBottom, pressed && styles.modeCardPressed]}
                onPress={handleOpenWitness}
              >
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>Ready to log it?</Text>
                <Text style={styles.modeCardDesc}>If you showed up, stood still,</Text>
                <Text style={styles.modeCardDesc}>and welcomed the day today.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Log for today</Text>
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
                <Text style={[styles.modeCardTitle, styles.modeCardTitleSecondary]}>🌅 Welcome the first light tomorrow</Text>
                <Text style={styles.modeCardDesc}>Tomorrow brings another sunrise.</Text>
                <Text style={styles.modeCardDesc}>Choose a moment to step outside and notice it.</Text>
                <View style={styles.modeCardButton}>
                  <Text style={styles.modeCardButtonText}>Plan for tomorrow</Text>
                </View>
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
      </ScrollView>
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
    paddingBottom: 24,
    paddingTop: 12,
  },
  tagline: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  ritualIntroCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  ritualIntroCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  ritualIntroCardBody: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  ritualIntroCardSupport: {
    fontSize: 12,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  anchorBlock: {
    marginBottom: 12,
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
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sunriseContextCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  sunriseContextCardBody: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  sunriseContextCardSub: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
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
    marginVertical: 12,
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
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  modeCardTightBottom: {
    marginBottom: 6,
  },
  modeCardPressed: {
    opacity: 0.92,
  },
  modeCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modeCardTitleSecondary: {
    fontSize: 17,
    fontWeight: '500',
    color: Dawn.text.primary,
  },
  modeCardDesc: {
    fontSize: 14,
    color: Dawn.text.secondary,
    lineHeight: 22,
    marginBottom: 2,
    textAlign: 'center',
  },
  modeCardButton: {
    marginTop: 14,
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
});
