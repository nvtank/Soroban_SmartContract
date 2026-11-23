import { z } from "zod";
import { ApiError, ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { createContract, listContracts } from "@/domain/contracts/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const dynamic = "force-dynamic";

const createContractSchema = z.object({
  roomLabel: z.string().min(1),
  rentAmount: z.string().regex(/^\d+$/),
  depositAmount: z.string().regex(/^\d+$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDay: z.number().int().min(1).max(31),
  lateFeeBpsPerDay: z.number().int().min(0).max(10000),
  termsText: z.string().min(1),
  tenantPhoneInvited: z.string().optional().nullable(),
});

export const GET = withApi(async () => {
  const user = await requireUser();
  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const contracts = await listContracts(repo, user);
  return ok(contracts);
});

export const POST = withApi(async (request: Request) => {
  const user = await requireUser();
  const input = await parseJson(request, createContractSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const contract = await createContract(repo, input, user, { enqueueOnchain });
  return ok(contract, 201);
});
