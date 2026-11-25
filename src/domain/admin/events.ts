import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/domain/dto";
import type { AdminAuditRow, AdminEvent, AdminEventAction } from "./dto";
import { bounds, ilikeAny, isId, like, pageOf, read, shortName, type AdminQuery } from "./read";

const summaries: Record<AdminEventAction, string> = {
  LOGIN: "Đăng nhập",
  LOGOUT: "Đăng xuất",
  CONTRACT_CREATED: "Tạo hợp đồng",
  CONTRACT_CONFIRMED: "Xác nhận hợp đồng",
  PAYMENT_CREATED: "Tạo yêu cầu thanh toán",
  PAYMENT_SETTLED: "Ghi nhận thanh toán mô phỏng",
  REFUND_REQUESTED: "Yêu cầu hoàn cọc",
  REFUND_APPROVED: "Xác nhận hoàn cọc",
  DEDUCTION_PROPOSED: "Đề xuất khấu trừ",
  DEDUCTION_RESPONDED: "Phản hồi đề xuất khấu trừ",
  DISPUTE_OPENED: "Mở tranh chấp",
  DISPUTE_RESOLVED: "Hai bên thống nhất kết quả tranh chấp",
  DUE_EXTENDED: "Gia hạn kỳ thanh toán",
  ONCHAIN_CONFIRMED: "Xác nhận giao dịch trên chuỗi",
  ONCHAIN_FAILED: "Giao dịch trên chuỗi thất bại",
  RECOVERY_REQUESTED: "Yêu cầu khôi phục tài khoản",
  RECOVERY_APPROVED: "Duyệt khôi phục tài khoản",
  ADMIN_ACTION: "Thực hiện tác vụ quản trị",
  OTHER: "Ghi nhận hoạt động nghiệp vụ",
};

const aliases = new Map<string, AdminEventAction>([
  ["DEPOSIT_RECORDED", "PAYMENT_SETTLED"],
  ["RENT_PAID", "PAYMENT_SETTLED"],
  ["RENT_PARTIALLY_PAID", "PAYMENT_SETTLED"],
  ["RENT_UNDERPAID", "PAYMENT_SETTLED"],
  ["REFUND_COMPLETED", "REFUND_APPROVED"],
  ["REFUND_APPROVED_ONE_PARTY", "REFUND_APPROVED"],
  ["DEDUCTION_ACCEPTED", "DEDUCTION_RESPONDED"],
  ["DEDUCTION_REJECTED_DISPUTE_OPENED", "DEDUCTION_RESPONDED"],
  ["DISPUTE_OPENED_DUE_TO_MISMATCH", "DISPUTE_OPENED"],
  ["RENT_DUE_EXTENDED", "DUE_EXTENDED"],
]);

const extraSummaries = new Map([
  ["ADMIN_RETRY_ONCHAIN", "Thử lại giao dịch trên chuỗi"],
  ["ADMIN_APPROVE_RECOVERY", "Quản trị viên duyệt khôi phục tài khoản"],
  ["ADMIN_RUN_OVERDUE_SCAN", "Chạy quét các kỳ quá hạn"],
  ["ADMIN_FLUSH_ONCHAIN", "Xử lý hàng đợi giao dịch"],
  ["RENT_MARKED_OVERDUE", "Ghi nhận kỳ thanh toán quá hạn"],
  ["CHARGE_CREATED", "Tạo khoản phụ thu"],
  ["CHARGE_MARKED_PAID", "Ghi nhận thanh toán khoản phụ thu"],
  ["DISPUTE_RESOLUTION_MISMATCH", "Hai bên đề xuất kết quả khác nhau"],
  ["DISPUTE_RESOLUTION_SUBMITTED_ONE_PARTY", "Một bên đề xuất kết quả tranh chấp"],
]);

type TargetType = NonNullable<AdminEvent["target"]>["type"];
const entityLabels: Record<TargetType, string> = {
  contract: "Hợp đồng",
  payment: "Thanh toán",
  onchain: "Giao dịch",
  user: "Người dùng",
  recovery: "Yêu cầu khôi phục",
};

const knownEntities = new Set([
  "profiles",
  "rental_contracts",
  "deposits",
  "rent_periods",
  "payments",
  "onchain_txs",
  "deduction_requests",
  "disputes",
  "contract_charges",
  "recovery_requests",
  "jobs",
]);

export const auditFields =
  "id,created_at,actor_id,action,entity,entity_id,meta,actor:profiles!actor_id(full_name,role)";

export type AuditRecord = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  meta: { contractId?: unknown; paymentId?: unknown } | null;
  actor: { full_name: string | null; role: UserRole } | null;
};

function eventAction(action: string): AdminEventAction {
  if (action.startsWith("ADMIN_")) return "ADMIN_ACTION";
  if (Object.hasOwn(summaries, action)) return action as AdminEventAction;
  return aliases.get(action) ?? "OTHER";
}

function targetFor(row: AuditRecord): AdminEvent["target"] {
  const make = (type: TargetType, id: unknown) => (isId(id) ? { type, id, label: entityLabels[type] } : null);
  if (row.entity === "profiles") return make("user", row.entity_id);
  if (row.entity === "payments") return make("payment", row.entity_id);
  if (row.entity === "onchain_txs") return make("onchain", row.entity_id);
  if (row.entity === "recovery_requests") return make("recovery", row.entity_id);
  if (isId(row.meta?.paymentId)) return make("payment", row.meta.paymentId);
  if (isId(row.meta?.contractId)) return make("contract", row.meta.contractId);
  if (["rental_contracts", "deposits", "disputes", "rent_periods"].includes(row.entity)) {
    return make("contract", row.entity_id.split(":")[0]);
  }
  return null;
}

export function toEvent(row: AuditRecord): AdminEvent {
  const action = eventAction(row.action);
  return {
    id: row.id,
    at: row.created_at,
    action,
    // Rút gọn họ tên người dùng; tài khoản quản trị luôn hiện "Quản trị viên"
    actorLabel: row.actor?.role === "ADMIN_DEMO" ? "Quản trị viên" : shortName(row.actor?.full_name ?? null),
    actorRole: row.actor?.role ?? "SYSTEM",
    actorId: row.actor_id,
    target: targetFor(row),
    summary: extraSummaries.get(row.action) ?? summaries[action],
  };
}

export function toAudit(row: AuditRecord): AdminAuditRow {
  const event = toEvent(row);
  return {
    id: event.id,
    at: event.at,
    actorLabel: event.actorLabel,
    actorRole: event.actorRole,
    action:
      Object.hasOwn(summaries, row.action) || aliases.has(row.action) || extraSummaries.has(row.action)
        ? row.action
        : event.action,
    entity: knownEntities.has(row.entity) ? row.entity : "other",
    entityId: isId(row.entity_id) ? row.entity_id : (event.target?.id ?? null),
    detail: event.summary,
  };
}

export async function listAudit(db: SupabaseClient, query: AdminQuery) {
  let actorIds: string[] = [];
  if (query.q) {
    const actors = read<{ id: string }[]>(
      await db.from("profiles").select("id").ilike("full_name", like(query.q)).order("id").limit(100),
    );
    actorIds = actors.map((actor) => actor.id);
  }
  let rows = db.from("audit_logs").select(auditFields, { count: "exact" });
  if (query.action === "ADMIN_ACTION") rows = rows.like("action", "ADMIN\\_%");
  else if (query.action) {
    const matches = [...aliases].filter(([, action]) => action === query.action).map(([raw]) => raw);
    rows = rows.in("action", [query.action, ...matches]);
  }
  if (query.q) {
    const fields = ilikeAny(["action", "entity", "entity_id"], query.q);
    rows = rows.or(actorIds.length ? `${fields},actor_id.in.(${actorIds.join(",")})` : fields);
  }
  const result = await rows
    .order("created_at", { ascending: false })
    .order("id")
    .range(...bounds(query));
  return pageOf(read<AuditRecord[]>(result).map(toAudit), result, query);
}

export async function recentEvents(
  db: SupabaseClient,
  filter: { since?: string; until?: string; actor?: string; contract?: string },
) {
  let rows = db.from("audit_logs").select(auditFields);
  if (filter.since) rows = rows.gt("created_at", filter.since);
  if (filter.until) rows = rows.lte("created_at", filter.until);
  if (filter.actor) rows = rows.eq("actor_id", filter.actor);
  if (filter.contract) {
    const id = filter.contract;
    rows = rows.or(`entity_id.eq.${id},entity_id.like.${id}:%,meta->>contractId.eq.${id}`);
  }
  return read<AuditRecord[]>(
    await rows.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30),
  ).map(toEvent);
}
