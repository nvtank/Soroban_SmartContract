import { z } from "zod";
import { safeEqual } from "@/lib/demo/auth";
import { setSessionCookie } from "@/lib/supabase/demo-session-cookie";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createCustodyWallet } from "@/lib/crypto/custody";
import { assertRateLimit, getClientIp } from "@/lib/supabase/rate-limit";
import type { SessionUser } from "@/domain/dto";

const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .min(8)
    .max(15)
    .regex(/^[0-9+]+$/),
  code: z.string().min(4).max(32),
  role: z.enum(["LANDLORD", "TENANT", "ADMIN_DEMO"]).optional(),
  fullName: z.string().optional(),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, VerifyOtpSchema);
  const phone = body.phone.trim();
  const code = body.code.trim();
  const admin = createAdminSupabase();
  const clientIp = getClientIp(request);

  // Giới hạn số lần xác thực theo IP (mặc định 20 lần mỗi 5 phút). Có thể nâng bằng OTP_VERIFY_IP_LIMIT,
  // ví dụ khi nhiều người dùng chung một mạng (cùng IP) trong buổi trình diễn. Giới hạn 5 lần sai mỗi mã vẫn giữ.
  const ipLimit = Math.max(1, Number(process.env.OTP_VERIFY_IP_LIMIT) || 20);
  await assertRateLimit(
    admin,
    `otp:ver:ip:${clientIp}`,
    ipLimit,
    300,
    "Quá nhiều lần thử xác thực từ địa chỉ IP này. Vui lòng thử lại sau.",
  );

  const isDemo = process.env.DEMO_MODE === "true";
  const isFixedDemoNumber =
    phone === "0900000001" || phone === "0900000002" || phone === "0900000003" || phone === "0900000004";

  let isValid = false;

  if (phone === "0900000004") {
    // Tài khoản quản trị demo: mã OTP là BÍ MẬT do người vận hành đặt (DEMO_ADMIN_OTP), không bao giờ công khai.
    // Nếu không đặt biến này thì không ai đăng nhập quản trị được. Không dùng bảng auth_otps cho số này.
    isValid = isDemo && safeEqual(code, process.env.DEMO_ADMIN_OTP ?? "", 8);
    if (!isValid) {
      throw new ApiError("VALIDATION_ERROR", undefined, "Mã OTP không đúng hoặc đã hết hạn.");
    }
  } else if (isDemo && isFixedDemoNumber && code === "123456") {
    // 1. Tài khoản demo công khai (chủ nhà, người thuê): mã OTP mô phỏng 123456
    isValid = true;
  } else {
    // 2. Check auth_otps
    const { data: otpRow } = await admin
      .from("auth_otps")
      .select("id, code, role, attempts, expires_at")
      .eq("phone", phone)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      throw new ApiError("VALIDATION_ERROR", undefined, "Mã OTP không đúng hoặc đã hết hạn.");
    }

    if (otpRow.attempts >= 5) {
      throw new ApiError(
        "RATE_LIMITED",
        undefined,
        "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.",
      );
    }

    if (otpRow.code !== code) {
      await admin
        .from("auth_otps")
        .update({ attempts: otpRow.attempts + 1 })
        .eq("id", otpRow.id);

      throw new ApiError("VALIDATION_ERROR", undefined, "Mã OTP không chính xác.");
    }

    isValid = true;
    await admin.from("auth_otps").delete().eq("id", otpRow.id);
  }

  if (!isValid) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Xác thực OTP thất bại.");
  }

  // 3. Find or create profile
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("phone", phone)
    .maybeSingle();

  // Vai trò do máy chủ quyết định: CHỈ 0900000004 mới nhận ADMIN_DEMO, client không tự chọn được
  const serverAssignedRole: SessionUser["role"] =
    phone === "0900000004" ? "ADMIN_DEMO" : body.role === "LANDLORD" ? "LANDLORD" : "TENANT";

  let user: SessionUser;

  if (existingProfile) {
    let finalRole: SessionUser["role"] = existingProfile.role;
    if (phone === "0900000004") {
      finalRole = "ADMIN_DEMO";
      if (existingProfile.role !== "ADMIN_DEMO") {
        await admin.from("profiles").update({ role: "ADMIN_DEMO" }).eq("id", existingProfile.id);
      }
    } else if (existingProfile.role === "ADMIN_DEMO") {
      // Số điện thoại không phải 0900000004 không bao giờ được giữ vai trò ADMIN_DEMO
      finalRole = serverAssignedRole;
      await admin.from("profiles").update({ role: finalRole }).eq("id", existingProfile.id);
    }

    user = {
      id: existingProfile.id,
      role: finalRole,
      fullName: existingProfile.full_name,
      phone: existingProfile.phone,
    };
  } else {
    // Create new user via seed_demo_user RPC
    const email = `${phone.replace(/\+/g, "")}@rentflow.local`;
    const fullName =
      body.fullName ||
      (phone === "0900000001"
        ? "Nguyễn Văn An"
        : phone === "0900000002"
          ? "Trần Thị Bình"
          : phone === "0900000003"
            ? "Lê Văn Cường"
            : phone === "0900000004"
              ? "Quản trị viên Demo"
              : "Người dùng");

    const newUserId =
      isFixedDemoNumber && phone === "0900000001"
        ? "00000000-0000-0000-0000-000000000001"
        : isFixedDemoNumber && phone === "0900000002"
          ? "00000000-0000-0000-0000-000000000002"
          : isFixedDemoNumber && phone === "0900000003"
            ? "00000000-0000-0000-0000-000000000003"
            : isFixedDemoNumber && phone === "0900000004"
              ? "00000000-0000-0000-0000-000000000004"
              : crypto.randomUUID();

    const { error: seedError } = await admin.rpc("seed_demo_user", {
      p_id: newUserId,
      p_email: email,
      p_phone: phone,
      p_full_name: fullName,
      p_role: serverAssignedRole,
    });

    if (seedError) {
      throw new ApiError("INTERNAL_ERROR", undefined, "Không thể tạo tài khoản người dùng.");
    }

    user = {
      id: newUserId,
      role: serverAssignedRole,
      fullName: fullName,
      phone: phone,
    };
  }

  // Ensure custody wallet exists
  await createCustodyWallet(admin, user.id);

  // Phiên đăng nhập là cookie httpOnly do server ký, client không sửa được uid hay role.
  await setSessionCookie(user.id, user.role);

  return ok({ user, isDemo });
});
