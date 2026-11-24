-- Migration: Contract charges (khoản nợ điện nước, phí dịch vụ)

create table if not exists public.contract_charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rental_contracts(id) on delete cascade,
  period_no integer,
  kind text not null check (kind in ('ELECTRICITY', 'WATER', 'SERVICE', 'OTHER')),
  amount bigint not null check (amount > 0),
  note text,
  status text not null default 'UNPAID' check (status in ('UNPAID', 'PAID')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_contract_charges_contract on public.contract_charges(contract_id);

alter table public.contract_charges enable row level security;

-- Revoke all permissions from public, anon, authenticated
revoke all on public.contract_charges from public, anon, authenticated;

-- Allow authenticated users to SELECT charges if they are participants in the contract
grant select on public.contract_charges to authenticated;

-- Grant all permissions to service_role and postgres
grant all on public.contract_charges to service_role, postgres;

-- RLS Policy: only participants (landlord or tenant) can select
drop policy if exists "charges_select_participants" on public.contract_charges;
create policy "charges_select_participants" on public.contract_charges
  for select to authenticated
  using (
    exists (
      select 1 from public.rental_contracts rc
      where rc.id = contract_charges.contract_id
        and (rc.landlord_id = auth.uid() or rc.tenant_id = auth.uid())
    )
  );
