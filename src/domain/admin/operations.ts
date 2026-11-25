import type { SupabaseClient } from "@supabase/supabase-js";
import { POST as approveExistingRecovery } from "@/app/api/recovery/[id]/approve/route";
import { scanOverdue } from "@/domain/jobs/overdue-scan";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";
import { ApiError } from "@/lib/api/http";
import { enqueueOnchain, flushOnchain, retryOnchainTx } from "@/lib/stellar/outbox";
import { getOnchain } from "./records";
import { read } from "./read";

type AdminOperation =
  "ADMIN_RETRY_ONCHAIN" | "ADMIN_APPROVE_RECOVERY" | "ADMIN_RUN_OVERDUE_SCAN" | "ADMIN_FLUSH_ONCHAIN";

async function auditOperation(
  db: SupabaseClient,
  actorId: string,
  action: AdminOperation,
  entity: string,
  id: string,
) {
  read(await db.from("audit_logs").insert({ actor_id: actorId, action, entity, entity_id: id }));
}

const inProgress = new Set<string>();

async function runOnce<Result>(key: string, operation: () => Promise<Result>) {
  if (inProgress.has(key)) throw new ApiError("INVALID_TRANSITION");
  inProgress.add(key);
  try {
    return await operation();
  } finally {
    inProgress.delete(key);
  }
}

export function retryTransaction(db: SupabaseClient, actorId: string, id: string) {
  return runOnce(`retry:${id}`, async () => {
    const current = await getOnchain(db, id);
    if (current.status !== "FAILED") throw new ApiError("INVALID_TRANSITION");
    await auditOperation(db, actorId, "ADMIN_RETRY_ONCHAIN", "onchain_txs", id);
    await retryOnchainTx(db, id);
    return getOnchain(db, id);
  });
}

async function recoveryStatus(db: SupabaseClient, id: string) {
  const record = read<{ status: string } | null>(
    await db.from("recovery_requests").select("status").eq("id", id).maybeSingle(),
  );
  if (!record) throw new ApiError("NOT_FOUND");
  return record.status;
}

export function approveRecovery(db: SupabaseClient, request: Request, actorId: string, id: string) {
  return runOnce(`recovery:${id}`, async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError("FORBIDDEN");
    if ((await recoveryStatus(db, id)) !== "PENDING") throw new ApiError("INVALID_TRANSITION");
    await auditOperation(db, actorId, "ADMIN_APPROVE_RECOVERY", "recovery_requests", id);
    const result = await approveExistingRecovery(request, { params: Promise.resolve({ id }) });
    await result.body?.cancel();
    if (!result.ok || (await recoveryStatus(db, id)) !== "APPROVED") throw new ApiError("INTERNAL_ERROR");
    return { ok: true as const };
  });
}

export async function runOverdueScan(db: SupabaseClient, actorId: string) {
  await auditOperation(db, actorId, "ADMIN_RUN_OVERDUE_SCAN", "jobs", "overdue-scan");
  return scanOverdue(createSupabaseDomainRepository(db), undefined, { enqueueOnchain });
}

export async function runFlushOnchain(db: SupabaseClient, actorId: string) {
  await auditOperation(db, actorId, "ADMIN_FLUSH_ONCHAIN", "jobs", "flush-onchain");
  return flushOnchain(db, { pollTimeoutMs: 3_000 });
}
