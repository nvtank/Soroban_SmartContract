import { ApiError, ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { requireStepUp } from "@/lib/crypto/step-up";
import { enqueueOnchain } from "@/lib/stellar/outbox";
import { extendDue, extendDueSchema } from "@/domain/rent/extend-due";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string; period: string }> }) => {
    const { id, period } = await context.params;
    const periodNo = Number(period);
    if (!Number.isInteger(periodNo) || periodNo < 1) throw new ApiError("VALIDATION_ERROR");

    const user = await requireUser();
    await requireStepUp(request, user.id, "EXTEND_DUE");
    const input = await parseJson(request, extendDueSchema);

    const repo = createSupabaseDomainRepository(createAdminSupabase());
    return ok(await extendDue(repo, id, periodNo, input, user, { enqueueOnchain }));
  },
);
