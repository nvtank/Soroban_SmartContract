import { z } from "zod";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

const ReissuePasskeySchema = z.object({
  requestId: z.string().uuid(),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, ReissuePasskeySchema);
  const admin = createAdminSupabase();

  const { data: rec } = await admin
    .from("recovery_requests")
    .select("id, user_id, phone, status, note")
    .eq("id", body.requestId)
    .maybeSingle();

  if (!rec) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy yêu cầu khôi phục.");
  }

  if (rec.status !== "APPROVED") {
    throw new ApiError(
      "FORBIDDEN",
      undefined,
      `Yêu cầu khôi phục chưa được phê duyệt (Trạng thái hiện tại: ${rec.status}). Cần admin duyệt trước khi cấp lại.`,
    );
  }

  // Update status to COMPLETED
  await admin
    .from("recovery_requests")
    .update({
      status: "COMPLETED",
      note: `${rec.note || ""} [COMPLETED: Đã hoàn tất cấp lại quyền truy cập]`.trim(),
    })
    .eq("id", rec.id);

  return ok({
    requestId: rec.id,
    userId: rec.user_id,
    status: "COMPLETED",
    isSimulated: true,
    message: "Đã hoàn tất quy trình khôi phục tài khoản. Bạn có thể đăng ký Passkey mới.",
  });
});
