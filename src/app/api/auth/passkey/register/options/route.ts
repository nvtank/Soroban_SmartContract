import { withApi, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { createPasskeyRegistrationOptions } from "@/lib/crypto/passkey";

export const POST = withApi(async () => {
  const user = await requireUser();
  const admin = createAdminSupabase();

  const options = await createPasskeyRegistrationOptions(
    admin,
    user.id,
    user.phone || "",
  );

  return ok(options);
});
