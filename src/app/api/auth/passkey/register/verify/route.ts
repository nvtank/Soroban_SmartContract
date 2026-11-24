import { z } from "zod";
import { withApi, parseJson, ok } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { verifyPasskeyRegistration } from "@/lib/crypto/passkey";

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
  const body = await parseJson(request, VerifyRegistrationSchema);
  const admin = createAdminSupabase();

  const verification = await verifyPasskeyRegistration(admin, user.id, body);

  return ok({ verified: verification.verified });
});
