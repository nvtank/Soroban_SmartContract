import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { requireStepUp } from "@/lib/crypto/step-up";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { respondDeduction } from "@/domain/deductions/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const dynamic = "force-dynamic";

const respondDeductionSchema = z.object({
  accept: z.boolean(),
});

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = await parseJson(request, respondDeductionSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const updated = await respondDeduction(repo, id, input, user, request, {
    requireStepUp,
    enqueueOnchain,
  });

  return ok(updated);
});
