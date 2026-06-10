-- Lightweight emotional memory of cities where the user has greeted sunrise.
-- Run once in the Supabase SQL editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sunrise_cities jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.sunrise_cities IS
  'Array of { city, first_seen_at, last_seen_at, mornings_count } — not travel analytics.';
