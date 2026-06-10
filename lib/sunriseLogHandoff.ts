import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SunriseLogSaveResult } from '@/components/SunriseLogCard';

const KEY = 'sunvantage_sunrise_log_handoff_v1';
const MAX_AGE_MS = 5 * 60 * 1000;

type StoredHandoff = SunriseLogSaveResult & { at: number };

/** In-memory copy survives double-fetch on Witness focus (consume-on-read was clearing the photo). */
let pendingHandoff: StoredHandoff | null = null;

function isFresh(handoff: StoredHandoff): boolean {
  return !handoff.at || Date.now() - handoff.at <= MAX_AGE_MS;
}

/** Pass optimistic post-save state into Witness after flows that navigate away (e.g. Vantage Hunt). */
export async function stashSunriseLogHandoff(result: SunriseLogSaveResult): Promise<void> {
  pendingHandoff = { ...result, at: Date.now() };
  await AsyncStorage.setItem(KEY, JSON.stringify(pendingHandoff));
}

/** Read pending handoff without clearing — safe across multiple Witness reloads. */
export async function resolveSunriseLogHandoff(): Promise<SunriseLogSaveResult | null> {
  if (pendingHandoff && isFresh(pendingHandoff)) {
    const { at: _at, ...result } = pendingHandoff;
    return result;
  }
  if (pendingHandoff && !isFresh(pendingHandoff)) {
    pendingHandoff = null;
  }

  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHandoff;
    if (!parsed?.logId || !isFresh(parsed)) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    pendingHandoff = parsed;
    const { at: _at, ...result } = parsed;
    return result;
  } catch {
    return null;
  }
}

export function peekSunriseLogHandoffSync(): SunriseLogSaveResult | null {
  if (!pendingHandoff || !isFresh(pendingHandoff)) return null;
  const { at: _at, ...result } = pendingHandoff;
  return result;
}

export async function clearSunriseLogHandoff(): Promise<void> {
  pendingHandoff = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** @deprecated Use resolveSunriseLogHandoff — kept for compatibility. */
export async function consumeSunriseLogHandoff(): Promise<SunriseLogSaveResult | null> {
  return resolveSunriseLogHandoff();
}
