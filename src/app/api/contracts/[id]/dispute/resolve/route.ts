import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { requireStepUp } from "@/lib/crypto/step-up";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { resolveDispute } from "@/domain/disputes/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


const resolveDisputeSchema = z.object({
  agreedAmount: z.string().regex(/^\d+$/),
});

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = await parseJson(request, resolveDisputeSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const dispute = await resolveDispute(repo, id, input, user, request, {
    requireStepUp,
    enqueueOnchain,
  });

  return ok(dispute);
});
