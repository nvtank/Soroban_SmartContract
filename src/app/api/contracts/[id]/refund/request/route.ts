import { ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { requestRefund } from "@/domain/deposits/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


export const POST = withApi(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const updated = await requestRefund(repo, id, user, { enqueueOnchain });
  return ok(updated);
});
