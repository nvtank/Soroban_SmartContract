import { ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { requireStepUp } from "@/lib/crypto/step-up";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { confirmContract } from "@/domain/contracts/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


export const POST = withApi(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  try {
    const updated = await confirmContract(repo, id, user, request, {
      requireStepUp,
      enqueueOnchain,
    });
    return ok(updated);
  } catch (err) {
    console.error("[confirm route error]:", err);
    throw err;
  }
});
