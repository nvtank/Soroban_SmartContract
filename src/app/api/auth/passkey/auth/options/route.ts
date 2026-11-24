import { z } from "zod";
import { withApi, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/session";
import { createPasskeyAuthOptions } from "@/lib/crypto/passkey";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";

const AuthOptionsSchema = z.object({
  phone: z.string().optional(),
});

export const POST = withApi(async (request: Request) => {
  const user = await getOptionalUser();
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Rate limit: max 30 auth options requests per 5 minutes per IP
  await assertRateLimit(
    admin,
    `passkey:auth:opt:${clientIp}`,
    30,
    300,
    "Thao tác quá nhanh, vui lòng thử lại sau.",
  );

  let targetUserId = user?.id;

  try {
    const json = await request.clone().json();
    const parsed = AuthOptionsSchema.safeParse(json);
    if (parsed.success && parsed.data.phone) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", parsed.data.phone)
        .maybeSingle();
      if (profile) {
        targetUserId = profile.id;
      }
    }
  } catch {
    // Body optional
  }

  const options = await createPasskeyAuthOptions(admin, targetUserId);
  return ok(options);
});
