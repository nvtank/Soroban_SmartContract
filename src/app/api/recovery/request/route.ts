import { z } from "zod";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

const RecoveryRequestSchema = z.object({
  phone: z.string().min(8).max(15).regex(/^[0-9+]+$/),
  note: z.string().max(500).optional(),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, RecoveryRequestSchema);
  const admin = createAdminSupabase();

  // Find user by phone
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", body.phone)
    .maybeSingle();

  if (!profile) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy tài khoản với số điện thoại này.");
  }

  const { data: req, error } = await admin
    .from("recovery_requests")
    .insert({
      user_id: profile.id,
      phone: body.phone,
      note: body.note || "Yêu cầu khôi phục quyền truy cập ví và tài khoản (mô phỏng).",
      status: "PENDING",
    })
    .select("id, status, created_at")
    .single();

  if (error || !req) {
    throw new ApiError("INTERNAL_ERROR", undefined, "Không thể tạo yêu cầu khôi phục.");
  }

  return ok({
    requestId: req.id,
    status: req.status,
    isSimulated: true,
    message: "Yêu cầu khôi phục tài khoản (mô phỏng) đã được tiếp nhận. Quản trị viên demo sẽ xét duyệt.",
  });
});
