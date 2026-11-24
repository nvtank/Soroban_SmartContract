import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { proposeDeduction } from "@/domain/deductions/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


const proposeDeductionSchema = z.object({
  amount: z.string().regex(/^\d+$/),
  reasonText: z.string().min(1),
});

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = await parseJson(request, proposeDeductionSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const deduction = await proposeDeduction(repo, id, input, user, { enqueueOnchain });
  return ok(deduction, 201);
});
