-- Backfill normalized_vantage and vantage_category for existing sunrise_logs rows.
-- Run after supabase_migration_vantage_normalization.sql.
-- Uses the same rules as lib/vantageUtils: lowercase, remove fillers (my,today,this,the),
-- synonyms (roof/rooftop→terrace, house→home), private = home|balcony|terrace|window|yard.

-- Step 1: strip fillers (word-boundary match) and collapse spaces
WITH cleaned AS (
  SELECT
    id,
    COALESCE(trim(vantage_name), '') AS raw,
    trim(regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(trim(COALESCE(vantage_name, ''))),
            '\mmy\M', ' ', 'g'
          ),
          '\mtoday\M', ' ', 'g'
        ),
        '\mthis\M', ' ', 'g'
      ),
      '\mthe\M', ' ', 'g'
    )) AS no_fillers
  FROM sunrise_logs
  WHERE vantage_name IS NOT NULL AND trim(vantage_name) <> ''
),
-- Step 2: collapse multiple spaces, then apply synonyms (rooftop before roof)
normalized AS (
  SELECT
    id,
    raw,
    trim(regexp_replace(
      replace(replace(replace(trim(regexp_replace(no_fillers, '\s+', ' ', 'g')), 'rooftop', 'terrace'), 'roof', 'terrace'), 'house', 'home'),
      '\s+', ' ', 'g'
    )) AS norm
  FROM cleaned
),
-- Step 3: category = private if norm is in (home, balcony, terrace, window, yard)
categorized AS (
  SELECT
    id,
    raw,
    CASE WHEN norm = '' THEN NULL ELSE norm END AS normalized_vantage,
    CASE
      WHEN norm = '' THEN 'private'
      WHEN norm IN ('home', 'balcony', 'terrace', 'window', 'yard') THEN 'private'
      ELSE 'public'
    END AS vantage_category
  FROM normalized
)
UPDATE sunrise_logs AS s
SET
  user_input_vantage = COALESCE(c.raw, trim(s.vantage_name), ''),
  normalized_vantage = c.normalized_vantage,
  vantage_category = c.vantage_category
FROM categorized AS c
WHERE s.id = c.id;
