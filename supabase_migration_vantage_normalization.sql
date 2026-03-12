-- Vantage normalization (MVP): store user input, normalized form, and category.
-- Run once against your sunrise_logs table.
-- Stats like "Most mornings from" use normalized_vantage; display uses user_input_vantage or vantage_name.

ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS user_input_vantage text;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS normalized_vantage text;
ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS vantage_category text;

-- Backfill: treat existing vantage_name as user input; app will set normalized_vantage/vantage_category on next edit.
-- Optional: set user_input_vantage from vantage_name so it's explicit.
UPDATE sunrise_logs
SET user_input_vantage = COALESCE(trim(vantage_name), '')
WHERE vantage_name IS NOT NULL AND (user_input_vantage IS NULL OR user_input_vantage = '');
