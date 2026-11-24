import { z } from "zod";
import { withApi, parseJson, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { verifyPasskeyRegistration } from "@/lib/crypto/passkey";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";

const VerifyRegistrationSchema = z.object({
  id: z.string(),
  rawId: z.string().optional(),
  response: z.record(z.string(), z.any()),
  type: z.literal("public-key").optional(),
  clientExtensionResults: z.record(z.string(), z.any()).optional(),
  authenticatorAttachment: z.string().optional(),
});

export const POST = withApi(async (request: Request) => {
  const user = await requireUser();
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Rate limit: max 20 registration verify attempts per 5 minutes
  await assertRateLimit(
    admin,
    `passkey:reg:ver:${user.id}:${clientIp}`,
    20,
    300,
    "Thao tác quá nhanh, vui lòng thử lại sau.",
  );

  const body = await parseJson(request, VerifyRegistrationSchema);
  const verification = await verifyPasskeyRegistration(admin, user.id, body as unknown as Parameters<typeof verifyPasskeyRegistration>[2]);

  return ok({ verified: verification.verified });
});
