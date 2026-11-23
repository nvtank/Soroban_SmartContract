import { z } from "zod";
import { withApi, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/session";
import { createPasskeyAuthOptions } from "@/lib/crypto/passkey";

const AuthOptionsSchema = z.object({
  phone: z.string().optional(),
});

export const POST = withApi(async (request: Request) => {
  const user = await getOptionalUser();
  const admin = createAdminSupabase();

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
