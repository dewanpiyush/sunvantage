-- RLS-safe global sunrise stats for the Global Sunrise Map.
-- Run in Supabase SQL editor. SECURITY DEFINER allows the function to bypass RLS.
-- Uses sunrise_day (user's local date at log time) so participation is correct across timezones.
-- display_date: optional; when provided (viewer's local today), use it; else use current_date (UTC).

alter table sunrise_logs add column if not exists country text;

create or replace function public.get_global_sunrise_stats(display_date date default null)
returns table (
  total_witnesses integer,
  city_count integer,
  country_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::integer as total_witnesses,
    count(distinct city)::integer as city_count,
    count(distinct country)::integer as country_count
  from sunrise_logs
  where (sunrise_day = coalesce(display_date, current_date))
     or (sunrise_day is null and (created_at at time zone 'UTC')::date = coalesce(display_date, current_date));
$$;
