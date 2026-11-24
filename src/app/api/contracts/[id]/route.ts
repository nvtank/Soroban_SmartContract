import { ok, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { getContractDetail } from "@/domain/contracts/service";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";


export const GET = withApi(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const user = await requireUser();
  const db = createAdminSupabase();
  const repo = createSupabaseDomainRepository(db);

  const contract = await getContractDetail(repo, id, user);
  return ok(contract);
});
