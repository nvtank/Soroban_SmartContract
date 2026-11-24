import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { openDispute } from "@/domain/disputes/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


const openDisputeSchema = z.object({
  note: z.string().optional(),
});

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = await parseJson(request, openDisputeSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const dispute = await openDispute(repo, id, input, user, { enqueueOnchain });
  return ok(dispute);
});
