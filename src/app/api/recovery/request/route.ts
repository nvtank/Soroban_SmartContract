import { z } from "zod";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";

const RecoveryRequestSchema = z.object({
  phone: z.string().min(8).max(15).regex(/^[0-9+]+$/),
  note: z.string().max(500).optional(),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, RecoveryRequestSchema);
  const phone = body.phone.trim();
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Rate limiting for account recovery requests
  await assertRateLimit(admin, `rec:req:phone:${phone}`, 3, 600, "Bạn đã gửi quá nhiều yêu cầu khôi phục. Vui lòng thử lại sau 10 phút.");
  await assertRateLimit(admin, `rec:req:ip:${clientIp}`, 10, 600, "Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 10 phút.");

  // Find user by phone
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, phone")
    .eq("phone", phone)
    .maybeSingle();

  if (!profile) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy tài khoản với số điện thoại này.");
  }

  // Insert recovery request
  const { data: req, error } = await admin
    .from("recovery_requests")
    .insert({
      user_id: profile.id,
      phone: phone,
      note: body.note || "Yêu cầu khôi phục quyền truy cập ví và tài khoản (mô phỏng).",
      status: "PENDING",
    })
    .select("id, status, created_at")
    .single();

  if (error || !req) {
    throw new ApiError("INTERNAL_ERROR", undefined, "Không thể tạo yêu cầu khôi phục.");
  }

  // Issue recovery OTP
  const isDemo = process.env.DEMO_MODE === "true";
  const code = isDemo ? "123456" : Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin.from("auth_otps").insert({
    phone,
    code,
    role: "RECOVERY",
    expires_at: expiresAt,
  });

  return ok({
    requestId: req.id,
    phone,
    status: req.status,
    isSimulated: true,
    message: "Yêu cầu khôi phục tài khoản (mô phỏng) đã được tiếp nhận. Mã OTP xác thực đã được gửi về số điện thoại.",
  });
});
