-- My Mornings screen: fetch current user's sunrise_logs (RLS applies via auth.uid()).
-- Use this from the app via Supabase client; no RPC required.

-- App query (JavaScript):
-- const { data, error } = await supabase
--   .from('sunrise_logs')
--   .select('id, created_at, vantage_name, reflection_text, reflection_question_id, photo_url')
--   .eq('user_id', userId)
--   .order('created_at', { ascending: false });

-- If your table does not yet have reflection_question_id, add it (optional):
-- ALTER TABLE sunrise_logs ADD COLUMN IF NOT EXISTS reflection_question_id integer;

-- For reference: same query in raw SQL (e.g. for SQL editor; replace with actual user_id or use a policy):
-- SELECT id, created_at, vantage_name, reflection_text, reflection_question_id, photo_url
-- FROM sunrise_logs
-- WHERE user_id = auth.uid()
-- ORDER BY created_at DESC;
