import { z } from "zod";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";

const RequestOtpSchema = z.object({
  phone: z.string().min(8).max(15).regex(/^[0-9+]+$/),
  role: z.enum(["LANDLORD", "TENANT", "ADMIN_DEMO"]).optional(),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, RequestOtpSchema);
  const phone = body.phone.trim();
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Durable rate limiting across serverless instances:
  // 1. Per phone: max 3 requests per 5 minutes (300s)
  await assertRateLimit(
    admin,
    `otp:req:phone:${phone}`,
    3,
    300,
    "Bạn thao tác quá nhanh, vui lòng thử lại sau 5 phút.",
  );

  // 2. Per IP: max 10 requests per 10 minutes (600s)
  await assertRateLimit(
    admin,
    `otp:req:ip:${clientIp}`,
    10,
    600,
    "Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 10 phút.",
  );

  // Secondary check on auth_otps table
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("auth_otps")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gt("created_at", fiveMinutesAgo);

  if (!countError && count !== null && count >= 3) {
    throw new ApiError("RATE_LIMITED", undefined, "Bạn thao tác quá nhanh, vui lòng thử lại sau 5 phút.");
  }

  // Generate 6-digit OTP code (in DEMO_MODE, fixed or random, but DO NOT log the OTP)
  const isDemo = process.env.DEMO_MODE === "true";
  const code = isDemo && (phone === "0900000001" || phone === "0900000002" || phone === "0900000003")
    ? "123456"
    : Math.floor(100000 + Math.random() * 900000).toString();

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Store in DB - do NOT log OTP
  await admin.from("auth_otps").insert({
    phone,
    code,
    role: body.role || "TENANT",
    expires_at: expiresAt,
  });

  return ok({
    success: true,
    phone,
    isDemo,
    expiresInSeconds: 300,
    message: isDemo
      ? "Mã OTP mô phỏng đã được tạo (gắn nhãn demo: mã 123456 cho số thử nghiệm)."
      : "Mã OTP đã được tạo thành công.",
  });
});
