-- Migration: Rate limits for durable multi-instance serverless rate limiting

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_expires on public.rate_limits(expires_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;
grant all on public.rate_limits to service_role, postgres;

-- Atomic rate limit check and increment function
create or replace function public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean as $$
declare
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  -- Delete expired entry if present
  delete from public.rate_limits where key = p_key and expires_at <= v_now;

  insert into public.rate_limits (key, count, expires_at)
  values (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
  on conflict (key) do update
    set count = case
      when public.rate_limits.expires_at <= v_now then 1
      else public.rate_limits.count + 1
    end,
    expires_at = case
      when public.rate_limits.expires_at <= v_now then v_now + (p_window_seconds || ' seconds')::interval
      else public.rate_limits.expires_at
    end
  returning count into v_count;

  return v_count <= p_max_requests;
end;
$$ language plpgsql security definer;
