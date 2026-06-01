import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import supabase from '../supabase';
import { useDawn } from '@/hooks/use-dawn';
import SunVantageHeader from '../components/SunVantageHeader';
import MarkerCard from '../components/MarkerCard';
import { hasLoggedToday } from '../lib/hasLoggedToday';
import { getNormalizedVantageFromRow } from '../lib/vantageUtils';
import {
  YMD_REGEX,
  createdAtToLocalDateString,
  computeStreakFromLogDates,
  getPreviousDayString,
} from '@/lib/streakStats';

// ----- Badge registry (v1) -----
export type BadgeId =
  | 'first_light'
  | 'returning_light'
  | 'steady_flame'
  | 'keeper_of_quiet'
  | 'new_ground'
  | 'city_walker';

export type BadgeDef = {
  id: BadgeId;
  title: string;
  description: string;
  earnedExplanation: string;
  lockedCopy: string;
  criteria: (stats: BadgeStats) => boolean;
};

export type BadgeStats = {
  totalLogs: number;
  currentStreak: number;
  longestStreak: number;
  reflectionCount: number;
  uniqueVantages: number;
  uniqueCities: number;
};

export const BADGE_REGISTRY: BadgeDef[] = [
  {
    id: 'first_light',
    title: 'First Light',
    description: 'You began.',
    earnedExplanation: 'You welcomed your first sunrise.',
    lockedCopy: 'Log your first sunrise.',
    criteria: (s) => s.totalLogs >= 1,
  },
  {
    id: 'returning_light',
    title: 'Returning Light',
    description: 'You came back.',
    earnedExplanation: 'You logged three mornings.',
    lockedCopy: 'Log 3 mornings in a row.',
    criteria: (s) => s.longestStreak >= 3,
  },
  {
    id: 'steady_flame',
    title: 'Steady Flame',
    description: 'You held the rhythm.',
    earnedExplanation: 'You kept the ritual for seven days.',
    lockedCopy: 'Log 7 mornings in a row.',
    criteria: (s) => s.longestStreak >= 7,
  },
  {
    id: 'keeper_of_quiet',
    title: 'Keeper of Quiet',
    description: 'You noticed.',
    earnedExplanation: 'You logged two reflections.',
    lockedCopy: 'Write 2 reflections.',
    criteria: (s) => s.reflectionCount >= 2,
  },
  {
    id: 'new_ground',
    title: 'New Ground',
    description: 'You moved with the light.',
    earnedExplanation: 'You welcomed the sunrise from two places.',
    lockedCopy: 'Log sunrise from 2 different places.',
    criteria: (s) => s.uniqueVantages >= 2,
  },
  {
    id: 'city_walker',
    title: 'City Walker',
    description: 'The ritual travels with you.',
    earnedExplanation: 'You welcomed the sunrise in 2 different cities.',
    lockedCopy: 'Welcome the sunrise in 2 different cities.',
    criteria: (s) => s.uniqueCities >= 2,
  },
];

/** Emoji per badge for the reveal card. */
export const BADGE_ICONS: Record<BadgeId, string> = {
  first_light: '🌅',
  returning_light: '🔥',
  steady_flame: '🔥',
  keeper_of_quiet: '🌿',
  new_ground: '📍',
  city_walker: '🌄',
};

function normalizeCity(v: string | null | undefined): string | null {
  if (v == null || typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  return t === '' ? null : t;
}

function formatEarnedMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ----- Log row (include reflection_text and optional city for stats) -----
type LogRow = {
  created_at: string;
  vantage_name: string | null;
  normalized_vantage?: string | null;
  user_input_vantage?: string | null;
  reflection_text: string | null;
  city?: string | null;
};

export function computeBadgeStats(logs: LogRow[]): BadgeStats {
  const createdAts = logs.map((r) => r.created_at);
  const streak = computeStreakFromLogDates(createdAts);
  const reflectionCount = logs.filter(
    (r) => r.reflection_text != null && String(r.reflection_text).trim() !== ''
  ).length;
  const vantageSet = new Set<string>();
  for (const r of logs) {
    const n = getNormalizedVantageFromRow(r);
    if (n !== null) vantageSet.add(n);
  }
  const citySet = new Set<string>();
  for (const r of logs) {
    const c = normalizeCity(r.city);
    if (c !== null) citySet.add(c);
  }
  return {
    totalLogs: logs.length,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    reflectionCount,
    uniqueVantages: vantageSet.size,
    uniqueCities: citySet.size,
  };
}

/** For each badge, compute the ISO date when it was first earned (for "Earned {Month Year}" and reveal-card ordering). */
export function computeEarnedAtByBadge(
  logs: LogRow[],
  stats: BadgeStats
): Partial<Record<BadgeId, string>> {
  const result: Partial<Record<BadgeId, string>> = {};
  const createdAts = [...new Set(logs.map((r) => createdAtToLocalDateString(r.created_at)))].filter(
    (s): s is string => Boolean(s) && YMD_REGEX.test(s)
  ).sort();

  if (stats.totalLogs >= 1 && logs.length > 0) {
    const first = logs.reduce((a, b) => (a.created_at < b.created_at ? a : b));
    result.first_light = first.created_at;
  }
  if (stats.longestStreak >= 3 && createdAts.length >= 3) {
    let run = 1;
    let runStartI = 0;
    for (let i = 1; i < createdAts.length; i++) {
      if (getPreviousDayString(createdAts[i]) === createdAts[i - 1]) {
        run++;
        if (run >= 3) {
          const thirdDateInRun = createdAts[runStartI + 2];
          const logForDate = logs.find((l) => createdAtToLocalDateString(l.created_at) === thirdDateInRun);
          if (logForDate) result.returning_light = logForDate.created_at;
          break;
        }
      } else {
        run = 1;
        runStartI = i;
      }
    }
  }
  if (stats.longestStreak >= 7 && createdAts.length >= 7) {
    let run = 1;
    let runStartI = 0;
    let bestRun = 0;
    let bestRunStartI = 0;
    for (let i = 1; i < createdAts.length; i++) {
      if (getPreviousDayString(createdAts[i]) === createdAts[i - 1]) {
        run++;
      } else {
        if (run > bestRun) {
          bestRun = run;
          bestRunStartI = runStartI;
        }
        run = 1;
        runStartI = i;
      }
    }
    if (run > bestRun) {
      bestRun = run;
      bestRunStartI = runStartI;
    }
    if (bestRun >= 7) {
      const earnedDate = createdAts[bestRunStartI + 6];
      const logForDate = logs.find((l) => createdAtToLocalDateString(l.created_at) === earnedDate);
      if (logForDate) result.steady_flame = logForDate.created_at;
    }
  }
  if (stats.reflectionCount >= 2) {
    const withReflection = logs.filter(
      (r) => r.reflection_text != null && String(r.reflection_text).trim() !== ''
    );
    if (withReflection.length >= 2) {
      const second = withReflection.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[1];
      result.keeper_of_quiet = second.created_at;
    }
  }
  if (stats.uniqueVantages >= 2) {
    const seen = new Set<string>();
    for (const r of logs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))) {
      const n = getNormalizedVantageFromRow(r);
      if (n !== null) {
        seen.add(n);
        if (seen.size >= 2) {
          result.new_ground = r.created_at;
          break;
        }
      }
    }
  }
  if (stats.uniqueCities >= 2) {
    const seen = new Set<string>();
    for (const r of logs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))) {
      const c = normalizeCity(r.city);
      if (c !== null) {
        seen.add(c);
        if (seen.size >= 2) {
          result.city_walker = r.created_at;
          break;
        }
      }
    }
  }
  return result;
}

/** Returns badges that are earned given current stats (for reveal card). */
export function getEarnedBadges(stats: BadgeStats): BadgeDef[] {
  return BADGE_REGISTRY.filter((b) => b.criteria(stats));
}

// ----- Screen -----
export default function RitualMarkersScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        setError('Please sign in to see your ritual markers.');
        setLogs([]);
        return;
      }

      const { data, error: logsError } = await supabase
        .from('sunrise_logs')
        .select('created_at, vantage_name, normalized_vantage, user_input_vantage, reflection_text, city')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (logsError) {
        if (/column.*does not exist|city|normalized_vantage/i.test(logsError.message ?? '')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('sunrise_logs')
            .select('created_at, vantage_name, reflection_text')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          if (fallbackError) {
            setError(fallbackError.message || 'Could not load logs.');
            return;
          }
          setLogs((fallbackData ?? []) as LogRow[]);
        } else {
          setError(logsError.message || 'Could not load logs.');
          return;
        }
      } else {
        setLogs((data ?? []) as LogRow[]);
      }
    } catch {
      setError('Something went wrong.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = computeBadgeStats(logs);
  const earnedAtByBadge = computeEarnedAtByBadge(logs, stats);

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
          title="Ritual Markers"
          subtitle="Moments your mornings have shaped."
          hasLoggedToday={hasLoggedToday(logs)}
          screenTitle
          showBack
          backLabel="← Back"
          onBackPress={() => router.back()}
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
          {(() => {
            const earnedBadges = BADGE_REGISTRY.filter((b) => b.criteria(stats));
            const lockedBadges = BADGE_REGISTRY.filter((b) => !b.criteria(stats));
            return (
              <>
                {earnedBadges.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Earned</Text>
                    {earnedBadges.map((badge) => {
                      const earnedAt = earnedAtByBadge[badge.id];
                      return (
                        <MarkerCard
                          key={badge.id}
                          variant="earned"
                          icon={BADGE_ICONS[badge.id]}
                          title={badge.title}
                          description={badge.description}
                          earnedExplanation={badge.earnedExplanation}
                          earnedMonthYear={earnedAt ? formatEarnedMonthYear(earnedAt) : ''}
                        />
                      );
                    })}
                  </View>
                )}
                {lockedBadges.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Still to unfold</Text>
                    {lockedBadges.map((badge) => (
                      <MarkerCard
                        key={badge.id}
                        variant="locked"
                        icon={BADGE_ICONS[badge.id]}
                        title={badge.title}
                        lockedCopy={badge.lockedCopy}
                      />
                    ))}
                  </View>
                )}
              </>
            );
          })()}
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
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Dawn.text.secondary,
    marginBottom: 11,
    letterSpacing: 0.5,
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
}
