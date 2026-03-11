-- Optional: add city to sunrise_logs for Ritual Markers "City Walker" badge (uniqueCities).
-- Run once if you want to track city per log. Ritual Markers screen works without it (badge stays locked).
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS city text;
