-- RLS-safe global gallery of recent sunrise photos.
-- Run in Supabase SQL editor. SECURITY DEFINER allows the function to bypass RLS
-- while only returning non-sensitive photo metadata (no emails, no profile fields).

create or replace function public.get_global_sunrise_gallery(limit_count integer default 30)
returns table (
  photo_url text,
  vantage_name text,
  created_at timestamptz,
  vantage_category text,
  user_id uuid,
  city text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.photo_url,
    s.vantage_name,
    s.created_at,
    s.vantage_category,
    s.user_id,
    s.city
  from sunrise_logs as s
  where s.photo_url is not null
  order by s.created_at desc
  limit limit_count;
$$;

