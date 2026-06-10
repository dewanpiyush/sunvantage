/**
 * Lightweight emotional memory of cities where the user has greeted sunrise.
 * Not travel analytics — a quiet profile-side record updated on log save.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeCityName } from '@/lib/activeSunriseCity';

export type SunriseCityMemoryEntry = {
  city: string;
  first_seen_at: string;
  last_seen_at: string;
  mornings_count: number;
};

export function parseSunriseCitiesMemory(raw: unknown): SunriseCityMemoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SunriseCityMemoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const city = typeof row.city === 'string' ? row.city.trim() : '';
    const first = typeof row.first_seen_at === 'string' ? row.first_seen_at : '';
    const last = typeof row.last_seen_at === 'string' ? row.last_seen_at : '';
    const count =
      typeof row.mornings_count === 'number'
        ? row.mornings_count
        : typeof row.mornings_count === 'string'
          ? parseInt(row.mornings_count, 10)
          : 0;
    if (!city || !first || !last || Number.isNaN(count) || count < 1) continue;
    out.push({
      city,
      first_seen_at: first,
      last_seen_at: last,
      mornings_count: count,
    });
  }
  return out;
}

export function upsertSunriseCityMemory(
  existing: SunriseCityMemoryEntry[],
  city: string,
  nowIso: string = new Date().toISOString()
): SunriseCityMemoryEntry[] {
  const trimmed = city.trim();
  if (!trimmed) return existing;

  const key = normalizeCityName(trimmed);
  const idx = existing.findIndex((e) => normalizeCityName(e.city) === key);

  if (idx >= 0) {
    const current = existing[idx]!;
    return existing.map((entry, i) =>
      i === idx
        ? {
            ...entry,
            last_seen_at: nowIso,
            mornings_count: current.mornings_count + 1,
          }
        : entry
    );
  }

  return [
    ...existing,
    {
      city: trimmed,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      mornings_count: 1,
    },
  ];
}

/** Fire-and-forget profile update after a sunrise log is saved. */
export async function recordSunriseCityMemory(
  client: SupabaseClient,
  userId: string,
  city: string
): Promise<void> {
  const trimmed = city?.trim();
  if (!trimmed || !userId) return;

  try {
    const { data, error: readError } = await client
      .from('profiles')
      .select('sunrise_cities')
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) {
      if (/sunrise_cities|column/i.test(readError.message ?? '')) return;
      return;
    }

    const existing = parseSunriseCitiesMemory(
      (data as { sunrise_cities?: unknown } | null)?.sunrise_cities
    );
    const next = upsertSunriseCityMemory(existing, trimmed);

    const { error: writeError } = await client
      .from('profiles')
      .update({ sunrise_cities: next })
      .eq('user_id', userId);

    if (writeError && /sunrise_cities|column/i.test(writeError.message ?? '')) return;
  } catch {
    // quiet — memory is supplementary
  }
}
