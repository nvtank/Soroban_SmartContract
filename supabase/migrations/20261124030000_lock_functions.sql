-- Migration: Lock down public functions, table privileges, and enforce server-only state mutations

-- 1. Fix check_rate_limit: set explicit search_path on SECURITY DEFINER
create or replace function public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

-- 2. Harden handle_new_user:
-- - Read role ONLY from raw_app_meta_data set by server, defaulting to TENANT
-- - Never accept ADMIN_DEMO from client (raw_user_meta_data is ignored for role)
-- - On conflict, NEVER update role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  -- Role can only come from server-controlled raw_app_meta_data.
  -- Client-supplied raw_user_meta_data is strictly ignored for role assignment.
  v_role := coalesce(new.raw_app_meta_data->>'role', 'TENANT');
  if v_role not in ('LANDLORD', 'TENANT') then
    if v_role <> 'ADMIN_DEMO' or new.raw_app_meta_data is null or not (new.raw_app_meta_data ? 'role') then
      v_role := 'TENANT';
    end if;
  end if;

  insert into public.profiles (id, phone, full_name, role)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_role
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, profiles.phone),
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name);
    -- On conflict NEVER alter role

  return new;
end;
$$;

-- 3. Harden seed_demo_user:
-- Set role inside raw_app_meta_data so handle_new_user and profiles reflect it properly
create or replace function public.seed_demo_user(
  p_id uuid,
  p_email text,
  p_phone text,
  p_full_name text,
  p_role text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into auth.users (
    id, instance_id, aud, role, email, phone, encrypted_password,
    email_confirmed_at, phone_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    p_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    p_phone,
    'test',
    now(),
    now(),
    jsonb_build_object('provider', 'phone', 'providers', jsonb_build_array('phone'), 'role', p_role),
    jsonb_build_object('full_name', p_full_name),
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data;

  insert into public.profiles (id, phone, full_name, role)
  values (p_id, p_phone, p_full_name, p_role)
  on conflict (id) do update set
    phone = coalesce(excluded.phone, profiles.phone),
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    role = excluded.role;
end;
$$;

-- 4. Revoke EXECUTE on all functions in public schema from PUBLIC, anon, authenticated
revoke execute on all functions in schema public from public, anon, authenticated;

-- 5. Alter default privileges so any newly created functions do NOT auto-grant execution
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 6. Grant execute privileges exclusively to service roles and superadmins
grant execute on all functions in schema public to postgres, service_role, supabase_admin;
grant execute on function public.handle_new_user() to postgres, supabase_admin, supabase_auth_admin, service_role;
grant execute on function public.seed_demo_user(uuid, text, text, text, text) to postgres, service_role, supabase_admin;
grant execute on function public.check_rate_limit(text, integer, integer) to postgres, service_role, supabase_admin;

-- 7. Fix profiles policies and permissions to prevent role escalation:
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- 8. Table-level lockdowns: Revoke broad permissions across all public tables
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- (a) rental_contracts: Client only has SELECT; mutations must pass through state machine on API server
drop policy if exists "contracts_insert_landlord" on public.rental_contracts;
drop policy if exists "contracts_update_participants" on public.rental_contracts;
drop policy if exists "contracts_select_participants" on public.rental_contracts;
create policy "contracts_select_participants" on public.rental_contracts
  for select to authenticated
  using (auth.uid() = landlord_id or auth.uid() = tenant_id);

revoke all on public.rental_contracts from anon, authenticated;
grant select on public.rental_contracts to authenticated;

-- (b) passkey_credentials: Client cannot insert/update directly (bypassing WebAuthn/step-up)
drop policy if exists "passkey_credentials_all_own" on public.passkey_credentials;
drop policy if exists "passkey_credentials_select_own" on public.passkey_credentials;
create policy "passkey_credentials_select_own" on public.passkey_credentials
  for select to authenticated
  using (auth.uid() = user_id);

revoke all on public.passkey_credentials from anon, authenticated;
grant select (id, user_id, credential_id, transports, created_at) on public.passkey_credentials to authenticated;

-- (c) recovery_requests: Client cannot approve or write directly
drop policy if exists "recovery_requests_own" on public.recovery_requests;
drop policy if exists "recovery_requests_select_own" on public.recovery_requests;
create policy "recovery_requests_select_own" on public.recovery_requests
  for select to authenticated
  using (auth.uid() = user_id);

revoke all on public.recovery_requests from anon, authenticated;
grant select on public.recovery_requests to authenticated;

-- (d) notifications: Authenticated can only update column read_at
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- (e) onchain_txs: Revoke all from anon; authenticated contract participants can select safe columns
drop policy if exists "onchain_txs_select_participants_or_anon" on public.onchain_txs;
drop policy if exists "onchain_txs_select_participants" on public.onchain_txs;
create policy "onchain_txs_select_participants" on public.onchain_txs
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = onchain_txs.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );

revoke all on public.onchain_txs from anon, authenticated;
grant select (id, contract_id, action, payload_hash, tx_hash, status, retry_count, created_at) on public.onchain_txs to authenticated;

-- (f) Read-only domain tables for authenticated participants (server writes via service_role):
revoke all on public.deposits from anon, authenticated;
grant select on public.deposits to authenticated;

revoke all on public.rent_periods from anon, authenticated;
grant select on public.rent_periods to authenticated;

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

revoke all on public.deduction_requests from anon, authenticated;
grant select on public.deduction_requests to authenticated;

revoke all on public.disputes from anon, authenticated;
grant select on public.disputes to authenticated;

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- (g) Sensitive server-only tables:
revoke all on public.auth_otps from anon, authenticated;
revoke all on public.auth_challenges from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.custody_wallets from anon, authenticated;
grant select (user_id, stellar_public_key, key_version, created_at) on public.custody_wallets to authenticated;

-- 9. Guarantee full operational access for service_role and postgres
grant all on all tables in schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, service_role;

-- 10. Revoke default table privileges from anon, authenticated for any future tables created by postgres
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
