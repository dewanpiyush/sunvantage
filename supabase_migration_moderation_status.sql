-- Add moderation_status for non-blocking image moderation.
-- Run in Supabase SQL editor.

alter table public.sunrise_logs
  add column if not exists moderation_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sunrise_logs_moderation_status_check'
  ) then
    alter table public.sunrise_logs
      add constraint sunrise_logs_moderation_status_check
      check (moderation_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- Existing rows with a published photo should be approved.
update public.sunrise_logs
set moderation_status = 'approved'
where photo_url is not null
  and moderation_status = 'pending';

