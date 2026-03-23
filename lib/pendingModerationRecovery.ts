/**
 * Re-invoke moderate-image for rows stuck in pending with a staged uploads_pending ref.
 * Fixes cases where the client never called the Edge Function (e.g. task dropped after navigation).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { invokeModerateImage } from '@/lib/moderateImageInvoke';

const PENDING_BUCKET_PREFIX = 'uploads_pending/';

/** Shared throttle for Home focus + AppState active so we don’t double-invoke. */
const RECOVERY_DEBOUNCE_MS = 45_000;
let lastDebouncedRecoveryAt = 0;

/**
 * Run pending moderation recovery at most once per {@link RECOVERY_DEBOUNCE_MS} (all call sites share this).
 * Use from Home focus and when the app returns to foreground (`AppState` `'active'`).
 */
export function runPendingModerationRecoveryDebounced(supabase: SupabaseClient): void {
  const now = Date.now();
  if (now - lastDebouncedRecoveryAt < RECOVERY_DEBOUNCE_MS) return;
  lastDebouncedRecoveryAt = now;
  void recoverPendingSunriseModeration(supabase);
}

/** Strip bucket prefix for Edge Function `path` (expects `userId/...` under uploads_pending). */
export function photoRefToStagedPath(photoUrl: string | null | undefined): string | null {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  const normalized = photoUrl.replace(/^\/+/, '');
  if (!normalized.includes(PENDING_BUCKET_PREFIX)) return null;
  const idx = normalized.indexOf(PENDING_BUCKET_PREFIX);
  const rest = normalized.slice(idx + PENDING_BUCKET_PREFIX.length).replace(/^\/+/, '');
  return rest || null;
}

export async function recoverPendingSunriseModeration(
  supabase: SupabaseClient,
  options?: { maxRows?: number }
): Promise<void> {
  const maxRows = options?.maxRows ?? 60;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  const { data: rows, error } = await supabase
    .from('sunrise_logs')
    .select('id, photo_url')
    .eq('user_id', userId)
    .eq('moderation_status', 'pending')
    .not('photo_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(maxRows);

  if (error || !rows?.length) return;

  const stuck = rows.filter((r) => photoRefToStagedPath(r.photo_url as string));

  for (const row of stuck) {
    const stagedPath = photoRefToStagedPath(row.photo_url as string);
    if (!stagedPath) continue;
    const logId = row.id as number;
    try {
      const { error: invokeError } = await invokeModerateImage(supabase, {
        path: stagedPath,
        type: 'sunrise',
        logId,
      });
      if (invokeError) {
        console.warn('[SunVantage] recover pending moderation invoke failed', {
          logId,
          message: invokeError.message,
        });
      }
    } catch (e) {
      console.warn('[SunVantage] recover pending moderation threw', { logId, e });
    }
  }
}
