import { z } from "zod";
import { setSessionCookie } from "@/lib/supabase/demo-session-cookie";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyPasskeyAuth } from "@/lib/crypto/passkey";
import { createCustodyWallet } from "@/lib/crypto/custody";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";
import type { SessionUser } from "@/domain/dto";

const VerifyAuthSchema = z.object({
  id: z.string(),
  rawId: z.string().optional(),
  response: z.record(z.string(), z.any()),
  type: z.literal("public-key").optional(),
  clientExtensionResults: z.record(z.string(), z.any()).optional(),
  authenticatorAttachment: z.string().optional(),
});

export const POST = withApi(async (request: Request) => {
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Rate limit: max 30 auth verify attempts per 5 minutes per IP
  await assertRateLimit(
    admin,
    `passkey:auth:ver:${clientIp}`,
    30,
    300,
    "Quá nhiều lần thử xác thực Passkey từ địa chỉ IP này. Vui lòng thử lại sau.",
  );

  const body = await parseJson(request, VerifyAuthSchema);
  const { verified, userId } = await verifyPasskeyAuth(admin, body as unknown as Parameters<typeof verifyPasskeyAuth>[1]);

  if (!verified || !userId) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Xác thực Passkey thất bại.");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy hồ sơ người dùng.");
  }

  const user: SessionUser = {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    phone: profile.phone,
  };

  // Ensure custody wallet exists
  await createCustodyWallet(admin, user.id);

  // Phiên đăng nhập là cookie httpOnly do server ký, client không sửa được uid hay role.
  await setSessionCookie(user.id, user.role);

  return ok({ verified: true, user });
});
