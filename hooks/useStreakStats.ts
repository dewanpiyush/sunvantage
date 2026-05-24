import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import supabase from '@/supabase';
import {
  fetchStreakStatsForUser,
  syncProfileStreakColumns,
  type StreakStats,
} from '@/lib/streakStats';

const EMPTY: StreakStats = {
  current: 0,
  longest: 0,
  lastDate: null,
  totalMornings: 0,
};

type UseStreakStatsOptions = {
  /** Refetch when the screen gains focus (default true). */
  refreshOnFocus?: boolean;
};

/**
 * Canonical streak state from sunrise logs — not cached profile columns.
 */
export function useStreakStats(options: UseStreakStatsOptions = {}) {
  const { refreshOnFocus = true } = options;
  const [stats, setStats] = useState<StreakStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setStats(EMPTY);
        return;
      }
      const next = await fetchStreakStatsForUser(supabase, userId);
      setStats(next);
      void syncProfileStreakColumns(supabase, userId, next);
    } catch {
      setStats(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (refreshOnFocus) reload();
    }, [refreshOnFocus, reload])
  );

  return {
    currentStreak: stats.current,
    longestStreak: stats.longest,
    totalMornings: stats.totalMornings,
    lastDate: stats.lastDate,
    loading,
    reload,
  };
}
