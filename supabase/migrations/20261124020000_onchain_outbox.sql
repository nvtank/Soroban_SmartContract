-- Migration: 20261124020000_onchain_outbox.sql
-- Agent D: Outbox table enhancements for atomic claiming and FIFO per contract

-- 1. Add lock and update tracking columns to onchain_txs
alter table public.onchain_txs
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

-- 2. Indexes for efficient queue polling and contract ordering
create index if not exists idx_onchain_txs_contract_created
  on public.onchain_txs (contract_id, created_at asc);

create index if not exists idx_onchain_txs_status_created
  on public.onchain_txs (status, created_at asc);

-- 3. Stored procedure for atomic claim
-- Enforces:
-- - FIFO per contract
-- - FAILED head blocks subsequent txs of that contract
-- - SUBMITTED head requires reconciliation before next tx
-- - Concurrent workers do not process the same contract (FOR UPDATE OF tx SKIP LOCKED)
-- - SECURITY DEFINER with search_path secured and EXECUTE revoked from anon/public
create or replace function public.claim_onchain_txs(
  p_worker_id text,
  p_limit int default 10,
  p_lock_timeout_seconds int default 60
)
returns setof public.onchain_txs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_stale_thresh timestamptz := v_now - (p_lock_timeout_seconds || ' seconds')::interval;
begin
  return query
  with active_contracts as (
    -- Any contract currently locked by another worker within timeout
    select distinct contract_id
    from public.onchain_txs
    where locked_at is not null
      and locked_at >= v_stale_thresh
      and locked_by is not null
      and locked_by != p_worker_id
  ),
  earliest_unconfirmed as (
    -- The single earliest non-confirmed transaction for each contract
    select distinct on (contract_id) contract_id, id, status
    from public.onchain_txs
    where status in ('PENDING', 'SUBMITTED', 'FAILED')
    order by contract_id, created_at asc, id asc
  ),
  eligible_heads as (
    -- Head must be PENDING or SUBMITTED (not FAILED, because FAILED blocks the contract)
    -- and contract must not be actively locked by another worker
    select eu.id, eu.contract_id
    from earliest_unconfirmed eu
    where eu.status in ('PENDING', 'SUBMITTED')
      and eu.contract_id not in (select contract_id from active_contracts)
  ),
  locked_txs as (
    -- Join to the real public.onchain_txs table and lock the real rows
    select tx.id
    from public.onchain_txs tx
    join eligible_heads eh on tx.id = eh.id
    where tx.locked_at is null or tx.locked_at < v_stale_thresh or tx.locked_by = p_worker_id
    order by tx.created_at asc
    limit p_limit
    for update of tx skip locked
  )
  update public.onchain_txs u
  set
    locked_at = v_now,
    locked_by = p_worker_id,
    updated_at = v_now
  from locked_txs l
  where u.id = l.id
  returning u.*;
end;
$$;

-- Revoke execute from public, anon, and authenticated for security
revoke all on function public.claim_onchain_txs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_onchain_txs(text, integer, integer) to service_role;
