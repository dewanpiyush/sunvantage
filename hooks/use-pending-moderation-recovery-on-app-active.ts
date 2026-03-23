import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

import { runPendingModerationRecoveryDebounced } from '@/lib/pendingModerationRecovery';

/**
 * When the app returns to the foreground (`AppState` → `'active'`), retry moderation for
 * sunrise logs stuck on `uploads_pending/...`. Shares a 45s debounce with Home focus
 * via {@link runPendingModerationRecoveryDebounced}.
 */
export function usePendingModerationRecoveryOnAppActive(supabase: SupabaseClient) {
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        runPendingModerationRecoveryDebounced(supabase);
      }
    };

    const sub = AppState.addEventListener('change', onChange);

    // Cold start / first paint: `change` may not fire; current state is already `active`.
    if (AppState.currentState === 'active') {
      runPendingModerationRecoveryDebounced(supabase);
    }

    return () => sub.remove();
  }, [supabase]);
}
