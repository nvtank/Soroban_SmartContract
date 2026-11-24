import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
import { requireStepUp } from "@/lib/crypto/step-up";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { approveRefund } from "@/domain/deposits/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const dynamic = "force-dynamic";

const approveRefundSchema = z.object({
  refundAmount: z.string().regex(/^\d+$/),
});

export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const input = await parseJson(request, approveRefundSchema);

  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const updated = await approveRefund(repo, id, input, user, request, {
    requireStepUp,
    enqueueOnchain,
  });

  return ok(updated);
});
