import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileCompleteness = { complete: boolean };

/**
 * Fetches profile for the given user and returns whether both first_name and city
 * are present (non-empty after trim). Used to gate access to the main app.
 */
export async function fetchProfileCompleteness(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileCompleteness> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, city')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { complete: false };
  }

  const first_name =
    typeof data.first_name === 'string' ? data.first_name.trim() : '';
  const city = typeof data.city === 'string' ? data.city.trim() : '';

  return {
    complete: first_name.length > 0 && city.length > 0,
  };
}
