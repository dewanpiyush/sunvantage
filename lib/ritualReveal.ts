import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BadgeDef, BadgeId } from '../app/ritual-markers';

const DISMISSED_KEY = 'ritual_reveal_dismissed';
const LAST_SEEN_KEY = 'ritual_reveal_last_seen_at';

/** Home only surfaces markers earned within this window (and after last visit). */
export const REVEAL_RECENT_MS = 36 * 60 * 60 * 1000;

/** Badge ids the user has dismissed (persisted forever). Once dismissed, the reveal card never shows again for that badge. */
export async function getDismissedBadgeIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Mark a badge as dismissed so the reveal card will never show it again. */
export async function dismissBadgeReveal(badgeId: string): Promise<void> {
  try {
    const current = await getDismissedBadgeIds();
    if (current.includes(badgeId)) return;
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, badgeId]));
  } catch {
    // ignore
  }
}

/** Last time the user opened Home (ms). Used so old markers do not resurface after absence. */
export async function getRevealLastSeenAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/** Call after Home evaluates reveals so earnedAt > lastSeenAt stays causal. */
export async function markRevealLastSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

/**
 * Pick at most one marker for Home: recently earned, not dismissed, earned since last Home visit.
 * Witness / save flow handles immediate reveals separately.
 */
export async function selectHomeRevealBadge(
  earned: BadgeDef[],
  earnedAtByBadge: Partial<Record<BadgeId, string>>
): Promise<BadgeDef | null> {
  if (earned.length === 0) return null;

  const [dismissed, lastSeenMs] = await Promise.all([getDismissedBadgeIds(), getRevealLastSeenAt()]);
  const now = Date.now();

  const eligible = earned.filter((b) => {
    if (dismissed.includes(b.id)) return false;
    const at = earnedAtByBadge[b.id];
    if (!at) return false;
    const earnedMs = new Date(at).getTime();
    if (Number.isNaN(earnedMs)) return false;
    if (now - earnedMs > REVEAL_RECENT_MS) return false;
    return earnedMs > lastSeenMs;
  });

  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    const atA = earnedAtByBadge[a.id] ?? '';
    const atB = earnedAtByBadge[b.id] ?? '';
    return atB.localeCompare(atA);
  });
  return sorted[0];
}
