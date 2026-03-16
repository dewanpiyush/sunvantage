-- Add sunrise_day for timezone-correct global map aggregation.
-- When a log is created, the client sets sunrise_day = user's local date (YYYY-MM-DD).
-- Aggregation uses sunrise_day instead of created_at so participation is correct across timezones.
-- Run in Supabase SQL editor before updating get_global_sunrise_stats and get_global_sunrise_cities.

alter table sunrise_logs add column if not exists sunrise_day date;

-- Optional: backfill existing rows so old logs still appear in "today" until next deploy.
-- update sunrise_logs set sunrise_day = (created_at at time zone 'UTC')::date where sunrise_day is null;
