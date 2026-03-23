-- One-time cleanup: rows already pointing at a public HTTPS URL but still marked `pending`
-- (e.g. after pipeline issues). Run in Supabase Dashboard → SQL Editor (or psql).
--
-- Optional: preview rows first
-- SELECT id, user_id, moderation_status, left(photo_url, 80) AS url_prefix
-- FROM sunrise_logs
-- WHERE photo_url LIKE 'https://%'
--   AND moderation_status = 'pending';

UPDATE sunrise_logs
SET moderation_status = 'approved'
WHERE photo_url LIKE 'https://%'
  AND moderation_status = 'pending';
