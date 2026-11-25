import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { getExplorerTxUrl } from "@/lib/stellar/explorer";
import type {
  AdminContractDetailDto,
  AdminContractRow,
  AdminOnchainRow,
  AdminPaymentRow,
  AdminRecoveryRow,
  AdminUserDetailDto,
  AdminUserRow,
} from "./dto";
import { recentEvents } from "./events";
import {
  bounds,
  displayText,
  ilikeAny,
  isId,
  like,
  maskPhone,
  pageOf,
  read,
  readAll,
  shortName,
  type AdminQuery,
} from "./read";
import { countIn, dailyPoints, dailyStart, dayKey } from "./series";

type Count = { count: number }[];
type Name = { full_name: string | null } | null;

type UserRecord = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  last_active_at: string | null;
  landlord: Count;
  tenant: Count;
  passkeys: Count;
  wallet: { stellar_public_key: string } | null;
};

const userFields = `id,role,full_name,phone,created_at,last_active_at,
  landlord:rental_contracts!landlord_id(count),tenant:rental_contracts!tenant_id(count),
  passkeys:passkey_credentials(count),wallet:custody_wallets(stellar_public_key)`;

function userRow(row: UserRecord): AdminUserRow {
  const key = row.wallet?.stellar_public_key;
  return {
    id: row.id,
    fullName: displayText(row.full_name),
    phoneMasked: maskPhone(row.phone),
    role: row.role,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    contractCount: (row.landlord[0]?.count ?? 0) + (row.tenant[0]?.count ?? 0),
    hasPasskey: (row.passkeys[0]?.count ?? 0) > 0,
    walletPublicKey: key && /^G[A-Z2-7]{55}$/.test(key) ? key : null,
  };
}

export async function listUsers(db: SupabaseClient, query: AdminQuery) {
  let rows = db.from("profiles").select(userFields, { count: "exact" });
  if (query.role) rows = rows.eq("role", query.role);
  if (query.q) {
    rows = isId(query.q) ? rows.eq("id", query.q) : rows.ilike("full_name", like(query.q));
  }
  const sorted =
    query.sort === "active" || query.sort === "lastActive"
      ? rows.order("last_active_at", { ascending: false, nullsFirst: false })
      : query.sort === "name"
        ? rows.order("full_name", { nullsFirst: false })
        : rows.order("created_at", { ascending: query.sort === "oldest" });
  const result = await sorted.order("id").range(...bounds(query));
  return pageOf(read<UserRecord[]>(result).map(userRow), result, query);
}

type ContractRecord = {
  id: string;
  room_label: string;
  status: AdminContractRow["status"];
  deposit: { status: AdminContractRow["depositStatus"] } | null;
  dispute: { status: AdminContractRow["disputeStatus"] } | null;
  landlord: Name;
  tenant: Name;
  rent_amount: string;
  deposit_amount: string;
  created_at: string;
  overdue: Count;
  confirmed: Count;
  chain: Count;
};

const contractFields = `id,room_label,status,rent_amount::text,deposit_amount::text,created_at,
  deposit:deposits(status),dispute:disputes(status),landlord:profiles!landlord_id(full_name),tenant:profiles!tenant_id(full_name),
  overdue:rent_periods(count),confirmed:onchain_txs(count),chain:onchain_txs(count)`;

const roomLabel = (value: string | null) => displayText(value) ?? "Phòng thuê";

function contractRow(row: ContractRecord): AdminContractRow {
  return {
    id: row.id,
    roomLabel: roomLabel(row.room_label),
    status: row.status,
    depositStatus: row.deposit?.status ?? "UNPAID",
    disputeStatus: row.dispute?.status ?? "NONE",
    landlordLabel: shortName(row.landlord?.full_name ?? null) ?? "Chủ nhà",
    tenantLabel: shortName(row.tenant?.full_name ?? null),
    rentAmount: row.rent_amount,
    depositAmount: row.deposit_amount,
    overduePeriods: row.overdue[0]?.count ?? 0,
    onchain: { confirmed: row.confirmed[0]?.count ?? 0, total: row.chain[0]?.count ?? 0 },
    createdAt: row.created_at,
  };
}

function contractQuery(db: SupabaseClient, count?: "exact") {
  return db
    .from("rental_contracts")
    .select(contractFields, { count })
    .eq("overdue.status", "OVERDUE")
    .eq("confirmed.status", "CONFIRMED");
}

export async function listContracts(db: SupabaseClient, query: AdminQuery) {
  let rows = contractQuery(db, "exact");
  if (query.status) rows = rows.eq("status", query.status);
  if (query.q) {
    const fields = ilikeAny(["room_label"], query.q);
    rows = rows.or(isId(query.q) ? `${fields},id.eq.${query.q}` : fields);
  }
  rows =
    query.sort === "room" || query.sort === "name"
      ? rows.order("room_label")
      : rows.order("created_at", { ascending: query.sort === "oldest" });
  const result = await rows.order("id").range(...bounds(query));
  return pageOf(read<ContractRecord[]>(result).map(contractRow), result, query);
}

type Room = { room_label: string } | null;
type PaymentRecord = {
  id: string;
  contract_id: string;
  order_code: string;
  room: Room;
  kind: AdminPaymentRow["kind"];
  period_no: number | null;
  expected_amount: string;
  paid_amount: string;
  status: AdminPaymentRow["status"];
  provider: string;
  is_simulated: boolean;
  created_at: string;
};

const paymentFields = `id,contract_id,order_code::text,kind,period_no,expected_amount::text,
  paid_amount::text,status,provider,is_simulated,created_at,room:rental_contracts(room_label)`;
export const fundedStatuses = new Set(["CONFIRMED", "UNDERPAID", "OVERPAID"]);

async function paymentRows(db: SupabaseClient, rows: PaymentRecord[]): Promise<AdminPaymentRow[]> {
  const codes = rows
    .filter((payment) => fundedStatuses.has(payment.status))
    .map((payment) => payment.order_code);
  const dates = new Map<string, string>();
  for (let offset = 0; offset < codes.length; offset += 100) {
    const events = await readAll<{ order_code: string; created_at: string }>((from, to) =>
      db
        .from("payment_events")
        .select("order_code::text,created_at")
        .in("order_code", codes.slice(offset, offset + 100))
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    for (const event of events)
      if (!dates.has(event.order_code)) dates.set(event.order_code, event.created_at);
  }
  return rows.map((row) => ({
    id: row.id,
    contractId: row.contract_id,
    roomLabel: roomLabel(row.room?.room_label ?? null),
    kind: row.kind,
    periodNo: row.period_no,
    expectedAmount: row.expected_amount,
    paidAmount: row.paid_amount,
    status: row.status,
    provider: row.provider === "PAYOS" ? "PAYOS" : "SIMULATED",
    isSimulated: row.is_simulated,
    createdAt: row.created_at,
    settledAt: dates.get(row.order_code) ?? null,
  }));
}

type OnchainRecord = {
  id: string;
  contract_id: string | null;
  room: Room;
  action: string;
  status: AdminOnchainRow["status"];
  tx_hash: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

const onchainFields =
  "id,contract_id,action,status,tx_hash,retry_count,created_at,updated_at,room:rental_contracts(room_label)";
const onchainActions = new Set([
  "create_contract",
  "tenant_confirm",
  "record_deposit_paid",
  "record_rent_paid",
  "request_refund",
  "approve_refund",
  "propose_deduction",
  "respond_deduction",
  "open_dispute",
  "resolve_dispute",
  "mark_overdue",
  "extend_due",
]);

function onchainRow(row: OnchainRecord): AdminOnchainRow {
  const hash = row.tx_hash && /^[0-9a-f]{64}$/i.test(row.tx_hash) ? row.tx_hash : null;
  return {
    id: row.id,
    contractId: row.contract_id,
    roomLabel: displayText(row.room?.room_label ?? null),
    action: onchainActions.has(row.action) ? row.action : "other",
    status: row.status,
    txHash: hash,
    explorerUrl: hash ? getExplorerTxUrl(hash) : null,
    retryCount: row.retry_count,
    error: row.status === "FAILED" ? "Giao dịch trên chuỗi thất bại." : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function matchingRooms(db: SupabaseClient, query: string) {
  return (
    await readAll<{ id: string }>((from, to) =>
      db.from("rental_contracts").select("id").ilike("room_label", like(query)).order("id").range(from, to),
    )
  ).map((room) => room.id);
}

export async function listPayments(db: SupabaseClient, query: AdminQuery) {
  let rows = db.from("payments").select(paymentFields, { count: "exact" });
  if (query.status) rows = rows.eq("status", query.status);
  if (query.q) {
    const rooms = await matchingRooms(db, query.q);
    const filters = [ilikeAny(["provider", "kind"], query.q)];
    if (isId(query.q)) filters.push(`id.eq.${query.q}`, `contract_id.eq.${query.q}`);
    if (rooms.length) filters.push(`contract_id.in.(${rooms.join(",")})`);
    rows = rows.or(filters.join(","));
  }
  const result = await rows
    .order("created_at", { ascending: false })
    .order("id")
    .range(...bounds(query));
  return pageOf(await paymentRows(db, read<PaymentRecord[]>(result)), result, query);
}

export async function listOnchain(db: SupabaseClient, query: AdminQuery) {
  let rows = db.from("onchain_txs").select(onchainFields, { count: "exact" });
  if (query.status) rows = rows.eq("status", query.status);
  if (query.q) {
    const rooms = await matchingRooms(db, query.q);
    const filters = [ilikeAny(["action", "tx_hash"], query.q)];
    if (isId(query.q)) filters.push(`id.eq.${query.q}`, `contract_id.eq.${query.q}`);
    if (rooms.length) filters.push(`contract_id.in.(${rooms.join(",")})`);
    rows = rows.or(filters.join(","));
  }
  const result = await rows
    .order("created_at", { ascending: false })
    .order("id")
    .range(...bounds(query));
  return pageOf(read<OnchainRecord[]>(result).map(onchainRow), result, query);
}

export async function getOnchain(db: SupabaseClient, id: string) {
  const row = read<OnchainRecord | null>(
    await db.from("onchain_txs").select(onchainFields).eq("id", id).maybeSingle(),
  );
  if (!row) throw new ApiError("NOT_FOUND");
  return onchainRow(row);
}

type PeriodRecord = {
  period_no: number;
  due_date: string;
  amount_due: string;
  amount_paid: string;
  late_fee: string;
  status: AdminContractDetailDto["periods"][number]["status"];
};

export async function getContract(db: SupabaseClient, id: string): Promise<AdminContractDetailDto> {
  const row = read<ContractRecord | null>(await contractQuery(db).eq("id", id).maybeSingle());
  if (!row) throw new ApiError("NOT_FOUND");
  const [periods, payments, txs, events] = await Promise.all([
    readAll<PeriodRecord>((from, to) =>
      db
        .from("rent_periods")
        .select("period_no,due_date,amount_due::text,amount_paid::text,late_fee::text,status")
        .eq("contract_id", id)
        .order("period_no")
        .range(from, to),
    ),
    readAll<PaymentRecord>((from, to) =>
      db
        .from("payments")
        .select(paymentFields)
        .eq("contract_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    readAll<OnchainRecord>((from, to) =>
      db
        .from("onchain_txs")
        .select(onchainFields)
        .eq("contract_id", id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    recentEvents(db, { contract: id }),
  ]);
  return {
    ...contractRow(row),
    periods: periods.map((period) => ({
      periodNo: period.period_no,
      dueDate: period.due_date,
      amountDue: period.amount_due,
      amountPaid: period.amount_paid,
      lateFee: period.late_fee,
      status: period.status,
    })),
    payments: await paymentRows(db, payments),
    onchainTxs: txs.map(onchainRow),
    events,
  };
}

export async function getUser(db: SupabaseClient, id: string): Promise<AdminUserDetailDto> {
  const row = read<UserRecord | null>(
    await db.from("profiles").select(userFields).eq("id", id).maybeSingle(),
  );
  if (!row) throw new ApiError("NOT_FOUND");
  const now = new Date();
  const [contracts, recent, activity] = await Promise.all([
    readAll<ContractRecord>((from, to) =>
      contractQuery(db)
        .or(`landlord_id.eq.${id},tenant_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    recentEvents(db, { actor: id }),
    readAll<{ created_at: string }>((from, to) =>
      db
        .from("audit_logs")
        .select("created_at")
        .eq("actor_id", id)
        .gte("created_at", dailyStart(now))
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  const counts = new Map<string, number>();
  for (const event of activity) countIn(counts, dayKey(event.created_at));
  return {
    ...userRow(row),
    contracts: contracts.map(contractRow),
    recentEvents: recent,
    activityByDay: dailyPoints(now, counts),
  };
}

type RecoveryRecord = {
  id: string;
  user_id: string;
  phone: string | null;
  status: string;
  created_at: string;
  user: Name;
};

export async function listRecovery(db: SupabaseClient): Promise<AdminRecoveryRow[]> {
  const rows = await readAll<RecoveryRecord>((from, to) =>
    db
      .from("recovery_requests")
      .select("id,user_id,phone,status,created_at,user:profiles!user_id(full_name)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userLabel: shortName(row.user?.full_name ?? null) ?? "Người dùng",
    phoneMasked: maskPhone(row.phone),
    status: row.status,
    createdAt: row.created_at,
  }));
}
