-- Run this in the Supabase SQL editor so the app can compute streaks from all your logs
-- (avoids RLS limiting which rows are returned).
create or replace function public.get_my_sunrise_log_dates()
returns table (created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select sunrise_logs.created_at
  from sunrise_logs
  where user_id = auth.uid()
  order by sunrise_logs.created_at desc
  limit 500;
$$;
