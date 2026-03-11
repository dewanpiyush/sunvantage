-- Run this in the Supabase SQL editor. Streak is computed in the DB from all your logs (no RLS).
-- Client sends timezone (e.g. Asia/Kolkata) so "today" and local dates are correct.
create or replace function public.get_my_streak(p_timezone text default 'UTC')
returns table (current_streak int, longest_streak int)
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  today_local date;
  yesterday_local date;
  last_log_date date;
  rec record;
  out_current int := 0;
  out_longest int := 0;
begin
  today_local := (now() at time zone tz)::date;
  yesterday_local := today_local - 1;

  -- Last day the user logged (in local tz)
  select max((created_at at time zone tz)::date) into last_log_date
  from sunrise_logs
  where user_id = auth.uid();

  -- Current streak: consecutive days ending on last log date, but only if streak is still "active"
  -- (last log was today or yesterday). If they missed a day, current = 0.
  if last_log_date is not null and last_log_date >= yesterday_local then
    for rec in
      with log_dates as (
        select distinct (created_at at time zone tz)::date as d
        from sunrise_logs
        where user_id = auth.uid()
      ),
      ordered as (
        select d, row_number() over (order by d desc) as rn
        from log_dates
      )
      select ordered.rn, ordered.d
      from ordered
      where ordered.d = last_log_date - (ordered.rn - 1)
      order by ordered.rn
    loop
      out_current := rec.rn;
    end loop;
  end if;

  -- Longest streak: longest run of consecutive days (gaps and islands)
  for rec in
    with log_dates as (
      select distinct (created_at at time zone tz)::date as d
      from sunrise_logs
      where user_id = auth.uid()
    ),
    ordered as (
      select d, row_number() over (order by d) as rn
      from log_dates
    ),
    grp as (
      select (d - (rn::int)) as g
      from ordered
    ),
    run_lengths as (
      select g, count(*) as len
      from grp
      group by g
    )
    select max(len) as mx from run_lengths
  loop
    out_longest := coalesce(rec.mx, 0);
  end loop;

  out_longest := greatest(out_longest, out_current);

  current_streak := out_current;
  longest_streak := out_longest;
  return next;
  return;
end;
$$;
