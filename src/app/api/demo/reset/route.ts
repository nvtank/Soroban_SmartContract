import { withApi, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { resetDemoData } from "@/lib/supabase/seed";
import { assertDemoRouteAccess } from "@/lib/demo/auth";

export const POST = withApi(async (request: Request) => {
  await assertDemoRouteAccess(request);

  const admin = createAdminSupabase();
  const result = await resetDemoData(admin);

  return ok({
    reset: true,
    isDemo: true,
    landlord: result.users.LANDLORD.phone,
    tenant1: result.users.TENANT_1.phone,
    tenant2: result.users.TENANT_2.phone,
    contractsCount: Object.keys(result.contracts).length,
  });
});
