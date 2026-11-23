-- RentFlow Database Migration

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  full_name text,
  role text not null check (role in ('LANDLORD', 'TENANT', 'ADMIN_DEMO')),
  created_at timestamptz not null default now()
);

-- 2. Custody Wallets
create table if not exists public.custody_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stellar_public_key text not null,
  encrypted_secret text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_custody_wallets_pubkey on public.custody_wallets(stellar_public_key);

-- 3. Passkey Credentials
create table if not exists public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_passkey_credentials_user on public.passkey_credentials(user_id);

-- 4. Rental Contracts
create table if not exists public.rental_contracts (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id),
  tenant_id uuid references public.profiles(id),
  tenant_phone_invited text,
  room_label text not null,
  rent_amount bigint not null check (rent_amount >= 0),
  deposit_amount bigint not null check (deposit_amount >= 0),
  start_date date not null,
  end_date date not null,
  due_day integer not null check (due_day between 1 and 31),
  late_fee_bps_per_day integer not null default 0 check (late_fee_bps_per_day >= 0),
  terms_text text not null default '',
  doc_hash text,
  doc_salt text,
  status text not null default 'PENDING_CONFIRMATION' check (status in ('PENDING_CONFIRMATION', 'ACTIVE', 'ENDED', 'CANCELLED')),
  onchain_ref text,
  created_at timestamptz not null default now()
);
create index if not exists idx_rental_contracts_landlord on public.rental_contracts(landlord_id);
create index if not exists idx_rental_contracts_tenant on public.rental_contracts(tenant_id);
create index if not exists idx_rental_contracts_status on public.rental_contracts(status);

-- 5. Deposits
create table if not exists public.deposits (
  contract_id uuid primary key references public.rental_contracts(id) on delete cascade,
  status text not null default 'UNPAID' check (status in ('UNPAID', 'RECORDED', 'PENDING_REFUND', 'PENDING_DISPUTE', 'REFUNDED', 'DEDUCTED')),
  paid_amount bigint not null default 0,
  refund_amount bigint not null default 0,
  deducted_amount bigint not null default 0,
  landlord_refund_amount bigint,
  tenant_refund_amount bigint,
  created_at timestamptz not null default now()
);

-- 6. Rent Periods
create table if not exists public.rent_periods (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  period_no integer not null check (period_no >= 1),
  due_date date not null,
  amount_due bigint not null check (amount_due >= 0),
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  late_days integer not null default 0 check (late_days >= 0),
  late_fee bigint not null default 0 check (late_fee >= 0),
  status text not null default 'NOT_DUE' check (status in ('NOT_DUE', 'AWAITING_PAYMENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID')),
  created_at timestamptz not null default now(),
  constraint uq_rent_period unique (contract_id, period_no)
);
create index if not exists idx_rent_periods_contract on public.rent_periods(contract_id, period_no);
create index if not exists idx_rent_periods_status on public.rent_periods(status);

-- 7. Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  kind text not null check (kind in ('DEPOSIT', 'RENT')),
  period_no integer,
  business_amount bigint not null,
  expected_amount bigint not null,
  paid_amount bigint not null default 0,
  provider text not null check (provider in ('PAYOS', 'SIMULATED')),
  order_code bigint not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'FAILED', 'UNDERPAID', 'OVERPAID', 'EXPIRED')),
  qr_data text,
  checkout_url text,
  is_simulated boolean not null default false,
  payment_ref_salt text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_contract on public.payments(contract_id);
create index if not exists idx_payments_order_code on public.payments(order_code);

-- 8. Payment Events
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  order_code bigint not null,
  event_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_events_order_code on public.payment_events(order_code);

-- 9. Deduction Requests
create table if not exists public.deduction_requests (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  amount bigint not null check (amount >= 0),
  reason_text text not null,
  reason_hash text,
  reason_salt text,
  status text not null default 'PROPOSED' check (status in ('PROPOSED', 'ACCEPTED', 'REJECTED')),
  created_at timestamptz not null default now()
);
create index if not exists idx_deductions_contract on public.deduction_requests(contract_id);

-- 10. Disputes
create table if not exists public.disputes (
  contract_id uuid primary key references public.rental_contracts(id) on delete cascade,
  status text not null default 'NONE' check (status in ('NONE', 'AWAITING_CONFIRMATION', 'IN_PROGRESS', 'RESOLVED')),
  opened_by uuid references public.profiles(id),
  note text,
  landlord_agreed_amount bigint,
  tenant_agreed_amount bigint,
  created_at timestamptz not null default now()
);

-- 11. On-chain Txs (Outbox Pattern)
create table if not exists public.onchain_txs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  action text not null,
  payload_hash text not null,
  args jsonb,
  signer jsonb,
  status text not null default 'PENDING' check (status in ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED')),
  tx_hash text,
  error text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_onchain_txs_contract on public.onchain_txs(contract_id);
create index if not exists idx_onchain_txs_status on public.onchain_txs(status);

-- 12. Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id);

-- 13. Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);

-- 14. Recovery Requests
create table if not exists public.recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  phone text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_recovery_requests_user on public.recovery_requests(user_id);

-- 15. Auth OTPs & Challenges
create table if not exists public.auth_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  role text,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_otps_phone on public.auth_otps(phone);

create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  challenge text not null,
  type text not null check (type in ('PASSKEY_REGISTRATION', 'PASSKEY_AUTH', 'STEP_UP')),
  action text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_challenges_user on public.auth_challenges(user_id);

-- Trigger for syncing new auth.users to public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone, full_name, role)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'TENANT')
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, profiles.phone),
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    role = coalesce(nullif(excluded.role, ''), profiles.role);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.custody_wallets enable row level security;
alter table public.passkey_credentials enable row level security;
alter table public.rental_contracts enable row level security;
alter table public.deposits enable row level security;
alter table public.rent_periods enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.deduction_requests enable row level security;
alter table public.disputes enable row level security;
alter table public.onchain_txs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.recovery_requests enable row level security;
alter table public.auth_otps enable row level security;
alter table public.auth_challenges enable row level security;

-- Grants
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select, insert, update, delete on public.passkey_credentials to authenticated;
grant select, insert, update on public.rental_contracts to authenticated;
grant select on public.deposits to authenticated;
grant select on public.rent_periods to authenticated;
grant select on public.payments to authenticated;
grant select on public.deduction_requests to authenticated;
grant select on public.disputes to authenticated;
grant select on public.onchain_txs to authenticated, anon;
grant select, update on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.recovery_requests to authenticated;

-- CRITICAL SECURITY: Custody Wallets encrypted_secret access
revoke all on public.custody_wallets from public, anon, authenticated;
grant select (user_id, stellar_public_key, key_version, created_at) on public.custody_wallets to authenticated;

-- Service role only tables
revoke all on public.payment_events from public, anon, authenticated;
revoke all on public.auth_otps from public, anon, authenticated;
revoke all on public.auth_challenges from public, anon, authenticated;
revoke insert, update, delete on public.payments from public, anon, authenticated;
revoke insert, update, delete on public.onchain_txs from public, anon, authenticated;

-- Policies

-- 1. Profiles
create policy "profiles_select_own_or_contract_peers" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.rental_contracts rc
      where (rc.landlord_id = auth.uid() and rc.tenant_id = profiles.id)
         or (rc.tenant_id = auth.uid() and rc.landlord_id = profiles.id)
    )
  );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- 2. Custody Wallets
create policy "custody_wallets_select_own" on public.custody_wallets
  for select to authenticated
  using (auth.uid() = user_id);

-- 3. Passkey Credentials
create policy "passkey_credentials_all_own" on public.passkey_credentials
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Rental Contracts
create policy "contracts_select_participants" on public.rental_contracts
  for select to authenticated
  using (auth.uid() = landlord_id or auth.uid() = tenant_id);

create policy "contracts_insert_landlord" on public.rental_contracts
  for insert to authenticated
  with check (auth.uid() = landlord_id);

create policy "contracts_update_participants" on public.rental_contracts
  for update to authenticated
  using (auth.uid() = landlord_id or auth.uid() = tenant_id)
  with check (auth.uid() = landlord_id or auth.uid() = tenant_id);

-- 5. Deposits
create policy "deposits_select_participants" on public.deposits
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = deposits.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );

-- 6. Rent Periods
create policy "rent_periods_select_participants" on public.rent_periods
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = rent_periods.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );

-- 7. Payments
create policy "payments_select_participants" on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = payments.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );

-- 8. Deduction Requests
create policy "deductions_select_participants" on public.deduction_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = deduction_requests.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );

-- 9. Disputes
create policy "disputes_select_participants" on public.disputes
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = disputes.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );

-- 10. Onchain Txs
create policy "onchain_txs_select_participants_or_anon" on public.onchain_txs
  for select
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = onchain_txs.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
    or auth.role() = 'anon'
  );

-- 11. Notifications
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 12. Audit Logs
create policy "audit_logs_select_own" on public.audit_logs
  for select to authenticated
  using (auth.uid() = actor_id);

-- 13. Recovery Requests
create policy "recovery_requests_own" on public.recovery_requests
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Helper function for seeding demo/simulated users directly
create or replace function public.seed_demo_user(
  p_id uuid,
  p_email text,
  p_phone text,
  p_full_name text,
  p_role text
) returns void as $$
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
    '{"provider":"phone","providers":["phone"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    raw_user_meta_data = excluded.raw_user_meta_data;

  insert into public.profiles (id, phone, full_name, role)
  values (p_id, p_phone, p_full_name, p_role)
  on conflict (id) do update set
    phone = excluded.phone,
    full_name = excluded.full_name,
    role = excluded.role;
end;
$$ language plpgsql security definer;
