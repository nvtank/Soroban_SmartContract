begin;

alter table public.profiles add column if not exists last_active_at timestamptz;
create index if not exists idx_profiles_last_active_at on public.profiles(last_active_at);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
create index if not exists idx_audit_logs_actor_created_at on public.audit_logs(actor_id, created_at);

create table if not exists public.admin_activity_minutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null,
  active_minute timestamptz not null,
  primary key (user_id, slot)
);
create index if not exists idx_admin_activity_minutes_at on public.admin_activity_minutes(active_minute);

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_activity_minutes enable row level security;
revoke all on public.admin_activity_minutes from public, anon, authenticated;
grant select, insert, update on public.admin_activity_minutes to service_role;

create or replace function public.record_admin_activity(profile_id uuid)
returns void language sql set search_path = '' as $$
  with touched as (
    update public.profiles set last_active_at = statement_timestamp()
    where id = profile_id and (
      last_active_at is null or last_active_at <= statement_timestamp() - interval '60 seconds'
    )
    returning id, last_active_at
  )
  insert into public.admin_activity_minutes (user_id, slot, active_minute)
  select id, (floor(extract(epoch from last_active_at) / 60)::bigint % 60)::smallint,
    date_trunc('minute', last_active_at)
  from touched
  on conflict (user_id, slot) do update set active_minute = excluded.active_minute;
$$;
revoke all on function public.record_admin_activity(uuid) from public, anon, authenticated;
grant execute on function public.record_admin_activity(uuid) to service_role;

commit;
