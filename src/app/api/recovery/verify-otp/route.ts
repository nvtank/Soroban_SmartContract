import { z } from "zod";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";

const VerifyRecoveryOtpSchema = z.object({
  requestId: z.string().uuid(),
  code: z.string().min(4).max(8),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, VerifyRecoveryOtpSchema);
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  await assertRateLimit(admin, `rec:otp:ver:${clientIp}`, 15, 300);

  // 1. Fetch recovery request
  const { data: rec } = await admin
    .from("recovery_requests")
    .select("id, user_id, phone, status, note")
    .eq("id", body.requestId)
    .maybeSingle();

  if (!rec) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy yêu cầu khôi phục.");
  }

  if (rec.status !== "PENDING") {
    throw new ApiError("VALIDATION_ERROR", undefined, `Yêu cầu khôi phục ở trạng thái '${rec.status}', không thể xác thực OTP.`);
  }

  // 2. Verify OTP
  const isDemo = process.env.DEMO_MODE === "true";
  const fixedCode = isDemo && body.code === "123456";

  let isValid = fixedCode;
  if (!isValid && rec.phone) {
    const { data: otpRow } = await admin
      .from("auth_otps")
      .select("id, code, attempts")
      .eq("phone", rec.phone)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpRow && otpRow.code === body.code.trim()) {
      isValid = true;
      await admin.from("auth_otps").delete().eq("id", otpRow.id);
    }
  }

  if (!isValid) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Mã OTP xác thực khôi phục không chính xác hoặc đã hết hạn.");
  }

  // 3. Update recovery note to reflect OTP verified
  const updatedNote = `${rec.note || ""} [OTP_VERIFIED]`.trim();
  await admin
    .from("recovery_requests")
    .update({ note: updatedNote })
    .eq("id", rec.id);

  return ok({
    requestId: rec.id,
    otpVerified: true,
    isSimulated: true,
    message: "Xác thực OTP thành công. Vui lòng tiếp tục bước nhận diện điện tử eKYC mô phỏng.",
  });
});
