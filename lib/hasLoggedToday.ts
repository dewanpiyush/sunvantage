/**
 * Helper: whether the user has logged today's sunrise (local calendar day).
 */

import { getTodayLocalDateString } from '@/lib/streakStats';

export function isTodayLocal(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** True if any log is for today — prefers `sunrise_day`, falls back to `created_at` (device-local). */
export function hasLoggedToday(
  logs: { created_at: string; sunrise_day?: string | null }[]
): boolean {
  const today = getTodayLocalDateString();
  return logs.some((log) => {
    const day = log.sunrise_day?.trim();
    if (day && day === today) return true;
    return isTodayLocal(log.created_at);
  });
}
