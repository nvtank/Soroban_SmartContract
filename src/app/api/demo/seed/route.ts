import { withApi, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { seedDemoData } from "@/lib/supabase/seed";

export const POST = withApi(async () => {
  if (process.env.DEMO_MODE !== "true") {
    throw new ApiError("NOT_FOUND");
  }

  const admin = createAdminSupabase();
  const result = await seedDemoData(admin);

  return ok({
    seeded: true,
    isDemo: true,
    landlord: result.users.LANDLORD.phone,
    tenant1: result.users.TENANT_1.phone,
    tenant2: result.users.TENANT_2.phone,
    contractsCount: Object.keys(result.contracts).length,
  });
});
