import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_KEY = 'ritual_reveal_dismissed';

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
