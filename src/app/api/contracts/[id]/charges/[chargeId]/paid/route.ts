import { ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { markChargePaid } from "@/domain/charges/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const POST = withApi(
  async (_request: Request, context: { params: Promise<{ id: string; chargeId: string }> }) => {
    const { id, chargeId } = await context.params;
    const user = await requireUser();

    const db = createAdminSupabase();
    const repo = createSupabaseDomainRepository(db);

    const charge = await markChargePaid(repo, id, chargeId, user);
    return ok(charge, 200);
  },
);
