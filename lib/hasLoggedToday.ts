/**
 * Helper for back navigation: whether the user has logged today's sunrise (local date).
 */

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

/** True if any of the given log created_at values fall on today (local). */
export function hasLoggedToday(logs: { created_at: string }[]): boolean {
  return logs.some((log) => isTodayLocal(log.created_at));
}
