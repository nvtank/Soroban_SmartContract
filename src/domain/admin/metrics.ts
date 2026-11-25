import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CONTRACT_STATUSES,
  DEPOSIT_STATUSES,
  DISPUTE_STATUSES,
  ONCHAIN_TX_STATUSES,
  PAYMENT_STATUSES,
  RENT_STATUSES,
} from "@/domain/states";
import { ApiError } from "@/lib/api/http";
import { checkStellarHealth } from "@/lib/stellar/health";
import type { AdminHealthDto, AdminLiveDto, AdminOverviewDto } from "./dto";
import { recentEvents } from "./events";
import { readAll } from "./read";
import { fundedStatuses } from "./records";
import { countIn, dailyPoints, dailyStart, dayKey, dayMs, minuteKey, minuteMs } from "./series";

type Profile = { role: string; created_at: string; last_active_at: string | null };
type Status<StatusName extends string> = { status: StatusName };
type Contract = Status<(typeof CONTRACT_STATUSES)[number]> & { created_at: string };
type Deposit = Status<(typeof DEPOSIT_STATUSES)[number]> & { paid_amount: string };
type Dispute = Status<(typeof DISPUTE_STATUSES)[number]>;
type Rent = Status<(typeof RENT_STATUSES)[number]> & {
  amount_due: string;
  amount_paid: string;
  late_fee: string;
};
type Onchain = Status<(typeof ONCHAIN_TX_STATUSES)[number]> & { updated_at: string };
type Payment = Status<(typeof PAYMENT_STATUSES)[number]> & {
  kind: string;
  is_simulated: boolean;
  paid_amount: string;
  expected_amount: string;
  order_code: string;
  created_at: string;
};

function byStatus<StatusName extends string>(statuses: readonly StatusName[], rows: Status<StatusName>[]) {
  const result = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<StatusName, number>;
  for (const { status } of rows) result[status]++;
  return result;
}

function dailyCount(now: Date, dates: string[]) {
  const counts = new Map<string, number>();
  for (const date of dates) countIn(counts, dayKey(date));
  return dailyPoints(now, counts);
}

async function overviewRows(db: SupabaseClient, now: Date) {
  const [profiles, contracts, deposits, disputes, rent, onchain, payments, paymentEvents, logins, recovery] =
    await Promise.all([
      readAll<Profile>((from, to) =>
        db.from("profiles").select("role,created_at,last_active_at").order("id").range(from, to),
      ),
      readAll<Contract>((from, to) =>
        db.from("rental_contracts").select("status,created_at").order("id").range(from, to),
      ),
      readAll<Deposit>((from, to) =>
        db.from("deposits").select("status,paid_amount::text").order("contract_id").range(from, to),
      ),
      readAll<Dispute>((from, to) =>
        db.from("disputes").select("status").order("contract_id").range(from, to),
      ),
      readAll<Rent>((from, to) =>
        db
          .from("rent_periods")
          .select("status,amount_due::text,amount_paid::text,late_fee::text")
          .order("id")
          .range(from, to),
      ),
      readAll<Onchain>((from, to) =>
        db.from("onchain_txs").select("status,updated_at").order("id").range(from, to),
      ),
      readAll<Payment>((from, to) =>
        db
          .from("payments")
          .select(
            "status,kind,is_simulated,paid_amount::text,expected_amount::text,order_code::text,created_at",
          )
          .order("id")
          .range(from, to),
      ),
      readAll<{ order_code: string; created_at: string }>((from, to) =>
        db
          .from("payment_events")
          .select("order_code::text,created_at")
          .gte("created_at", new Date(now.getTime() - 30 * dayMs).toISOString())
          .lte("created_at", now.toISOString())
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      readAll<{ created_at: string }>((from, to) =>
        db
          .from("audit_logs")
          .select("created_at")
          .eq("action", "LOGIN")
          .gte("created_at", dailyStart(now))
          .lte("created_at", now.toISOString())
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
      db.from("recovery_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    ]);
  if (recovery.error) throw new ApiError("INTERNAL_ERROR");
  return {
    profiles,
    contracts,
    deposits,
    disputes,
    rent,
    onchain,
    payments,
    paymentEvents,
    logins,
    pending: recovery.count ?? 0,
  };
}

export async function overview(db: SupabaseClient, now = new Date()): Promise<AdminOverviewDto> {
  const { profiles, contracts, deposits, disputes, rent, onchain, payments, paymentEvents, logins, pending } =
    await overviewRows(db, now);
  const asOf = now.toISOString();
  const weekStart = new Date(now.getTime() - 7 * dayMs).toISOString();
  const yesterday = new Date(now.getTime() - dayMs).toISOString();
  const monthStart = new Date(now.getTime() - 30 * dayMs).toISOString();
  const chainInMonth = onchain.filter((tx) => within(tx.updated_at, monthStart, asOf));
  const confirmed = chainInMonth.filter((tx) => tx.status === "CONFIRMED");
  const failed = chainInMonth.filter((tx) => tx.status === "FAILED");
  const terminal = confirmed.length + failed.length;
  const held = new Set(["RECORDED", "PENDING_REFUND", "PENDING_DISPUTE"]);
  const heldAmount = deposits.reduce(
    (total, deposit) => total + (held.has(deposit.status) ? BigInt(deposit.paid_amount) : 0n),
    0n,
  );
  const overdueAmount = rent.reduce((total, period) => {
    if (period.status !== "OVERDUE") return total;
    const due = BigInt(period.amount_due) + BigInt(period.late_fee) - BigInt(period.amount_paid);
    return total + (due > 0n ? due : 0n);
  }, 0n);

  const lastPayment = new Map<string, string>();
  for (const event of paymentEvents) {
    if (!lastPayment.has(event.order_code)) lastPayment.set(event.order_code, event.created_at);
  }
  const paymentsAmount = new Map<string, bigint>();
  let collectedLast30d = 0n;
  for (const payment of payments) {
    const settled = lastPayment.get(payment.order_code) ?? payment.created_at;
    if (!fundedStatuses.has(payment.status) || !within(settled, monthStart, asOf)) continue;
    const date = dayKey(settled);
    const paid = BigInt(payment.paid_amount);
    paymentsAmount.set(date, (paymentsAmount.get(date) ?? 0n) + paid);
    if (payment.kind === "RENT") {
      const expected = BigInt(payment.expected_amount);
      collectedLast30d += paid > expected ? expected : paid;
    }
  }

  const depositCounts = byStatus(DEPOSIT_STATUSES, deposits);
  depositCounts.UNPAID += Math.max(0, contracts.length - deposits.length);
  const disputeCounts = byStatus(DISPUTE_STATUSES, disputes);
  disputeCounts.NONE += Math.max(0, contracts.length - disputes.length);
  return {
    generatedAt: asOf,
    kpis: {
      users: {
        total: profiles.length,
        landlords: profiles.filter((profile) => profile.role === "LANDLORD").length,
        tenants: profiles.filter((profile) => profile.role === "TENANT").length,
        newLast7d: profiles.filter((profile) => within(profile.created_at, weekStart, asOf)).length,
        activeLast24h: profiles.filter(
          (profile) => profile.last_active_at && within(profile.last_active_at, yesterday, asOf),
        ).length,
      },
      contracts: { total: contracts.length, byStatus: byStatus(CONTRACT_STATUSES, contracts) },
      deposits: { byStatus: depositCounts, heldAmount: heldAmount.toString() },
      rent: {
        byStatus: byStatus(RENT_STATUSES, rent),
        overdueAmount: overdueAmount.toString(),
        collectedLast30d: collectedLast30d.toString(),
      },
      disputes: { byStatus: disputeCounts },
      payments: {
        byStatus: byStatus(PAYMENT_STATUSES, payments),
        simulatedShare: payments.length
          ? payments.filter((payment) => payment.is_simulated).length / payments.length
          : 0,
      },
      onchain: {
        byStatus: byStatus(ONCHAIN_TX_STATUSES, onchain),
        successRate: terminal ? confirmed.length / terminal : 0,
      },
      recovery: { pending },
    },
    series: {
      newUsers: dailyCount(
        now,
        profiles.map((profile) => profile.created_at),
      ),
      newContracts: dailyCount(
        now,
        contracts.map((contract) => contract.created_at),
      ),
      paymentsAmount: dailyPoints(now, paymentsAmount),
      onchainConfirmed: dailyCount(
        now,
        confirmed.map((tx) => tx.updated_at),
      ),
      onchainFailed: dailyCount(
        now,
        failed.map((tx) => tx.updated_at),
      ),
      logins: dailyCount(
        now,
        logins.map((login) => login.created_at),
      ),
    },
  };
}

function within(date: string, from: string, to: string) {
  const time = Date.parse(date);
  return time >= Date.parse(from) && time <= Date.parse(to);
}

async function queue(db: SupabaseClient, now: Date) {
  const [pending, submitted, failed, oldest] = await Promise.all([
    db.from("onchain_txs").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    db.from("onchain_txs").select("id", { count: "exact", head: true }).eq("status", "SUBMITTED"),
    db.from("onchain_txs").select("id", { count: "exact", head: true }).eq("status", "FAILED"),
    db
      .from("onchain_txs")
      .select("created_at")
      .eq("status", "PENDING")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (pending.error || submitted.error || failed.error || oldest.error) throw new ApiError("INTERNAL_ERROR");
  return {
    pending: pending.count ?? 0,
    submitted: submitted.count ?? 0,
    failed: failed.count ?? 0,
    oldestPendingSeconds: oldest.data
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(oldest.data.created_at)) / 1_000))
      : null,
  };
}

export function parseSince(request: Request) {
  const since = new URL(request.url).searchParams.get("since");
  if (since === null) return undefined;
  if (!z.iso.datetime({ offset: true }).safeParse(since).success) throw new ApiError("VALIDATION_ERROR");
  return since;
}

export async function live(db: SupabaseClient, since?: string, now = new Date()): Promise<AdminLiveDto> {
  const start = minuteKey(now) - 59 * minuteMs;
  const firstMinute = new Date(start).toISOString();
  const activeSince = new Date(now.getTime() - 5 * minuteMs).toISOString();
  const asOf = now.toISOString();
  const [active, activity, audits, events, counts] = await Promise.all([
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", activeSince)
      .lte("last_active_at", asOf),
    readAll<{ active_minute: string }>((from, to) =>
      db
        .from("admin_activity_minutes")
        .select("active_minute")
        .gte("active_minute", firstMinute)
        .lte("active_minute", asOf)
        .order("active_minute")
        .order("user_id")
        .range(from, to),
    ),
    readAll<{ created_at: string }>((from, to) =>
      db
        .from("audit_logs")
        .select("created_at")
        .gte("created_at", firstMinute)
        .lte("created_at", asOf)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    recentEvents(db, { since, until: asOf }),
    queue(db, now),
  ]);
  if (active.error) throw new ApiError("INTERNAL_ERROR");
  const activeCounts = new Map<number, number>();
  const eventCounts = new Map<number, number>();
  for (const entry of activity) countIn(activeCounts, minuteKey(entry.active_minute));
  for (const audit of audits) countIn(eventCounts, minuteKey(audit.created_at));
  const minutes = Array.from({ length: 60 }, (_, index) => start + index * minuteMs);
  const points = (source: Map<number, number>) =>
    minutes.map((at) => ({ at: new Date(at).toISOString(), value: source.get(at) ?? 0 }));
  return {
    now: asOf,
    activeUsers: active.count ?? 0,
    activeSeries: points(activeCounts),
    eventSeries: points(eventCounts),
    events,
    queue: { pending: counts.pending, submitted: counts.submitted, failed: counts.failed },
  };
}

async function databaseHealth(db: SupabaseClient) {
  const start = performance.now();
  let ok = false;
  try {
    const result = await db.from("profiles").select("id").limit(1).abortSignal(AbortSignal.timeout(5_000));
    ok = !result.error;
  } catch {
    ok = false;
  }
  return { ok, latencyMs: Math.round(performance.now() - start) };
}

async function stellarHealth(): Promise<AdminHealthDto["stellar"]> {
  const status = await checkStellarHealth().catch(() => null);
  const contractId = status?.contract.contractId;
  return {
    rpcOk: status?.rpc.ok ?? false,
    latestLedger: status?.rpc.latestLedger ?? null,
    contractOk: status?.contract.ok ?? false,
    contractId: contractId && /^C[A-Z2-7]{55}$/.test(contractId) ? contractId : null,
    platformBalanceXlm: status?.balances.platform.balanceXlm ?? null,
    oracleBalanceXlm: status?.balances.oracle.balanceXlm ?? null,
    lowBalance: Boolean(status?.balances.platform.isLow || status?.balances.oracle.isLow),
    error: !status?.rpc.ok
      ? "Không kết nối được Stellar RPC."
      : !status.contract.ok
        ? "Không xác minh được hợp đồng Stellar."
        : !status.balances.ok
          ? "Không kiểm tra được số dư Stellar."
          : null,
  };
}

export async function health(db: SupabaseClient, now = new Date()): Promise<AdminHealthDto> {
  const [database, stellar, counts] = await Promise.all([
    databaseHealth(db),
    stellarHealth(),
    queue(db, now).catch(() => null),
  ]);
  const paymentMode = process.env.PAYMENT_MODE;
  return {
    checkedAt: now.toISOString(),
    database,
    stellar,
    queue: counts ?? { pending: 0, submitted: 0, failed: 0, oldestPendingSeconds: null },
    demoMode: process.env.DEMO_MODE === "true",
    paymentMode: paymentMode === "payos" ? "payos" : "simulated",
  };
}
