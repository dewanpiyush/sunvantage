-- RLS-safe aggregated cities for Global Sunrise Map dots.
-- Run in Supabase SQL editor after get_global_sunrise_stats.
-- Uses sunrise_day; display_date optional (viewer's local today).

create or replace function public.get_global_sunrise_cities(max_cities integer default 200, display_date date default null)
returns table (
  city text,
  country text,
  lat double precision,
  lng double precision,
  logs bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with today_logs as (
    select
      trim(s.city) as city,
      trim(s.country) as country,
      round(s.latitude::numeric, 2) as lat,
      round(s.longitude::numeric, 2) as lng
    from sunrise_logs s
    where (s.sunrise_day = coalesce(display_date, current_date)
       or (s.sunrise_day is null and (s.created_at at time zone 'UTC')::date = coalesce(display_date, current_date)))
      and s.city is not null and trim(s.city) != ''
      and s.latitude is not null and s.longitude is not null
  ),
  agg as (
    select
      city,
      coalesce(country, '') as country,
      lat,
      lng,
      count(*) as logs
    from today_logs
    group by city, country, lat, lng
    order by count(*) desc
    limit max_cities
  )
  select agg.city, agg.country, agg.lat::double precision, agg.lng::double precision, agg.logs
  from agg;
$$;
