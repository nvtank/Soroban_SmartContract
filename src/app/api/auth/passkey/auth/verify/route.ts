import { z } from "zod";
import { cookies } from "next/headers";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyPasskeyAuth } from "@/lib/crypto/passkey";
import { createCustodyWallet } from "@/lib/crypto/custody";
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
  const body = await parseJson(request, VerifyAuthSchema);
  const admin = createAdminSupabase();

  const { verified, userId } = await verifyPasskeyAuth(admin, body);

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

  // Set session cookie
  try {
    const cookieStore = await cookies();
    cookieStore.set("rentflow_demo_user_id", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  } catch {
    // In unit tests or non-Next request context
  }

  return ok({ verified: true, user });
});
