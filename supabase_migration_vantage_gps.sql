-- Vantage + future GPS: add normalized vantage name (for grouping/count) and nullable lat/long (no UI yet).
-- Run once against your sunrise_logs table.

ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS vantage_name_normalized text;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS longitude double precision;

-- Optional: backfill normalized from existing vantage_name for old rows.
-- UPDATE sunrise_logs
-- SET vantage_name_normalized = lower(trim(vantage_name))
-- WHERE vantage_name IS NOT NULL AND (vantage_name_normalized IS NULL OR vantage_name_normalized = '');
