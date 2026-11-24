import { z } from "zod";
import { ApiError, ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";
import { verifyPasskeyAuth } from "@/lib/crypto/passkey";
import { createStepUpSession } from "@/lib/crypto/step-up";

/**
 * Cấp mã xác thực bước hai dùng MỘT LẦN, gắn đúng người dùng và đúng thao tác.
 * - passkey: xác minh chữ ký WebAuthn thật của chính người đang đăng nhập.
 * - otp: MÔ PHỎNG (chưa có nhà cung cấp SMS), chỉ chấp nhận mã demo khi DEMO_MODE=true.
 */
const StepUpSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("passkey"),
    action: z.enum(["SIGN_CONTRACT", "APPROVE_REFUND", "RESPOND_DEDUCTION", "RESOLVE_DISPUTE", "EXTEND_DUE"]),
    credential: z.object({
      id: z.string(),
      rawId: z.string().optional(),
      response: z.record(z.string(), z.any()),
      type: z.literal("public-key").optional(),
      clientExtensionResults: z.record(z.string(), z.any()).optional(),
      authenticatorAttachment: z.string().optional(),
    }),
  }),
  z.object({
    method: z.literal("otp"),
    action: z.enum(["SIGN_CONTRACT", "APPROVE_REFUND", "RESPOND_DEDUCTION", "RESOLVE_DISPUTE", "EXTEND_DUE"]),
    code: z.string().min(4).max(8),
  }),
]);

export const POST = withApi(async (request: Request) => {
  const user = await requireUser();
  const admin = createAdminSupabase();
  await assertRateLimit(
    admin,
    `stepup:${user.id}:${getClientIp(request)}`,
    20,
    300,
    "Bạn xác thực quá nhiều lần, vui lòng thử lại sau.",
  );

  const input = await parseJson(request, StepUpSchema);

  if (input.method === "passkey") {
    const { verified, userId } = await verifyPasskeyAuth(
      admin,
      input.credential as unknown as Parameters<typeof verifyPasskeyAuth>[1],
    );
    // Passkey phải là của chính người đang đăng nhập, không dùng Passkey của người khác để ký thay
    if (!verified || userId !== user.id) {
      throw new ApiError("UNAUTHENTICATED", undefined, "Xác thực Passkey thất bại.");
    }
  } else {
    if (process.env.DEMO_MODE !== "true") {
      throw new ApiError("FORBIDDEN", undefined, "Chưa cấu hình dịch vụ gửi OTP. Vui lòng dùng Passkey.");
    }
    if (input.code !== "123456") {
      throw new ApiError("FORBIDDEN", undefined, "Mã OTP không đúng.");
    }
  }

  return ok(await createStepUpSession(admin, user.id, input.action));
});
