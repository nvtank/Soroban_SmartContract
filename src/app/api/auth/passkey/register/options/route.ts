import { withApi, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { createPasskeyRegistrationOptions } from "@/lib/crypto/passkey";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";

export const POST = withApi(async (request: Request) => {
  const user = await requireUser();
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Rate limit: max 20 registration option requests per 5 minutes per user/IP
  await assertRateLimit(
    admin,
    `passkey:reg:opt:${user.id}:${clientIp}`,
    20,
    300,
    "Thao tác quá nhanh, vui lòng thử lại sau.",
  );

  const options = await createPasskeyRegistrationOptions(
    admin,
    user.id,
    user.phone || "",
  );

  return ok(options);
});
