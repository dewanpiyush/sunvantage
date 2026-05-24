import type { SupabaseClient } from '@supabase/supabase-js';

export const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type StreakStats = {
  current: number;
  longest: number;
  lastDate: string | null;
  totalMornings: number;
};

const EMPTY_STREAK: StreakStats = {
  current: 0,
  longest: 0,
  lastDate: null,
  totalMornings: 0,
};

export function createdAtToLocalDateString(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getTodayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getYesterdayLocalDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getPreviousDayString(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const y2 = date.getFullYear();
  const m2 = date.getMonth();
  const d2 = date.getDate();
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}

/** Canonical streak from log timestamps (device-local calendar days). */
export function computeStreakFromLogDates(createdAts: string[]): StreakStats {
  const validDates = createdAts
    .map(createdAtToLocalDateString)
    .filter((s): s is string => Boolean(s) && YMD_REGEX.test(s));

  if (validDates.length === 0) return { ...EMPTY_STREAK };

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

  return {
    current,
    longest,
    lastDate,
    totalMornings: validDates.length,
  };
}

/** Alias for readability in screens. */
export function getStreakStats(createdAts: string[]): StreakStats {
  return computeStreakFromLogDates(createdAts);
}

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function normalizeLogDatesFromRpc(rpcData: unknown): string[] {
  if (!Array.isArray(rpcData)) return [];
  return rpcData
    .map((r) => {
      if (typeof r === 'string') return r;
      if (Array.isArray(r) && r.length > 0 && typeof r[0] === 'string') return r[0];
      if (r != null && typeof r === 'object' && !Array.isArray(r)) {
        const row = r as Record<string, unknown>;
        const at = row.created_at ?? row.createdAt;
        return typeof at === 'string' ? at : null;
      }
      return null;
    })
    .filter((s): s is string => typeof s === 'string');
}

export async function fetchLogDatesForUser(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data: rpcData, error: rpcError } = await client.rpc('get_my_sunrise_log_dates');
  if (!rpcError && rpcData != null) return normalizeLogDatesFromRpc(rpcData);

  const { data } = await client
    .from('sunrise_logs')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

  return (data ?? []).map((r) => r?.created_at).filter((s): s is string => typeof s === 'string');
}

export async function fetchStreakFromRpc(
  client: SupabaseClient
): Promise<Pick<StreakStats, 'current' | 'longest'> | null> {
  const tz = getDeviceTimezone();
  const { data, error } = await client.rpc('get_my_streak', { p_timezone: tz });
  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  const current =
    typeof r.current_streak === 'number'
      ? r.current_streak
      : typeof r.current_streak === 'string'
        ? parseInt(r.current_streak, 10)
        : 0;
  const longest =
    typeof r.longest_streak === 'number'
      ? r.longest_streak
      : typeof r.longest_streak === 'string'
        ? parseInt(r.longest_streak, 10)
        : 0;

  return {
    current: Number.isNaN(current) ? 0 : current,
    longest: Number.isNaN(longest) ? 0 : Math.max(longest, current),
  };
}

/** Truthful streak from logs — same source Home and Profile use. */
export async function fetchStreakStatsForUser(client: SupabaseClient, userId: string): Promise<StreakStats> {
  const createdAts = await fetchLogDatesForUser(client, userId);
  return computeStreakFromLogDates(createdAts);
}

/** Heal stale `profiles.current_streak` / `longest_streak` when they drift from logs. */
export async function syncProfileStreakColumns(
  client: SupabaseClient,
  userId: string,
  stats: StreakStats
): Promise<void> {
  const { data: profile } = await client
    .from('profiles')
    .select('current_streak, longest_streak, last_witness_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) return;

  const storedCurrent =
    typeof profile.current_streak === 'number'
      ? profile.current_streak
      : typeof profile.current_streak === 'string'
        ? parseInt(profile.current_streak, 10)
        : 0;
  const storedLongest =
    typeof profile.longest_streak === 'number'
      ? profile.longest_streak
      : typeof profile.longest_streak === 'string'
        ? parseInt(profile.longest_streak, 10)
        : 0;
  const storedLast =
    profile.last_witness_date != null ? String(profile.last_witness_date).slice(0, 10) : null;

  const needsUpdate =
    storedCurrent !== stats.current ||
    storedLongest !== stats.longest ||
    (stats.lastDate != null && storedLast !== stats.lastDate);

  if (!needsUpdate) return;

  await client
    .from('profiles')
    .update({
      current_streak: stats.current,
      longest_streak: stats.longest,
      last_witness_date: stats.lastDate,
    })
    .eq('user_id', userId);
}
