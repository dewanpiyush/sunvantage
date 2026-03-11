-- My Profile screen: data is fetched from the app via Supabase client.
-- No RPC required; RLS applies via auth.uid().

-- 1) Profile (name, city)
-- const { data } = await supabase
--   .from('profiles')
--   .select('first_name, city')
--   .eq('user_id', userId)
--   .maybeSingle();

-- 2) Sunrise logs (for earliest date, count, streak input, vantages)
-- const { data } = await supabase
--   .from('sunrise_logs')
--   .select('created_at, vantage_name')
--   .eq('user_id', userId)
--   .order('created_at', { ascending: true });

-- Streaks, unique vantages, and most-returned vantage are computed client-side
-- from the logs array (see computeStreakFromLogDates and vantage grouping in MyProfileScreen).
