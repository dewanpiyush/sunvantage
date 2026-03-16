-- Backfill city-level coordinates on sunrise_logs from profiles.
-- Goal: older sunrise logs get latitude/longitude so they show as dots on the Global Sunrise Map.
-- This uses profile data only (no external geocoding), so it's safe and fast.
-- Run this once in the Supabase SQL editor.

-- 1) Ensure profiles has latitude/longitude so we can store per-user coords.
alter table profiles add column if not exists latitude double precision;
alter table profiles add column if not exists longitude double precision;

-- 2) Ensure sunrise_logs has latitude/longitude/city columns (should already exist from migrations, but keep idempotent).
alter table sunrise_logs add column if not exists latitude double precision;
alter table sunrise_logs add column if not exists longitude double precision;
alter table sunrise_logs add column if not exists city text;

-- 3) Copy coordinates and city from profiles onto existing logs where missing.
--    We only touch rows that currently lack coords to avoid overwriting anything you've already set.
update sunrise_logs s
set
  latitude = p.latitude,
  longitude = p.longitude,
  city = coalesce(s.city, p.city)
from profiles p
where p.user_id = s.user_id
  and (s.latitude is null or s.longitude is null);

-- After this backfill, any user whose profile has latitude/longitude will have
-- all of their past logs populated with city-level coords, and they will appear
-- as dots via get_global_sunrise_cities().

