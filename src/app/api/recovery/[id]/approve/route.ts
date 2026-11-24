import { withApi, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import crypto from "crypto";

export const POST = withApi(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  if (process.env.DEMO_MODE !== "true") {
    throw new ApiError("FORBIDDEN", undefined, "Chức năng duyệt khôi phục chỉ khả dụng trong chế độ DEMO_MODE.");
  }

  const { id } = await context.params;
  const admin = createAdminSupabase();

  const { data: rec } = await admin
    .from("recovery_requests")
    .select("id, user_id, phone, status, note")
    .eq("id", id)
    .maybeSingle();

  if (!rec) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy yêu cầu khôi phục.");
  }

  // 1. REVOKE OLD PASSKEYS: Delete all existing passkeys for this user
  const { data: deletedCreds, error: delError } = await admin
    .from("passkey_credentials")
    .delete()
    .eq("user_id", rec.user_id)
    .select("id");

  if (delError) {
    throw new ApiError("INTERNAL_ERROR", undefined, "Không thể thu hồi Passkey cũ.");
  }

  const revokedCount = deletedCreds?.length || 0;

  // 2. Generate recovery reset token in auth_challenges
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await admin.from("auth_challenges").insert({
    user_id: rec.user_id,
    challenge: resetToken,
    type: "STEP_UP",
    action: "SIGN_CONTRACT",
    expires_at: expiresAt,
  });

  // 3. Update recovery status to APPROVED
  await admin
    .from("recovery_requests")
    .update({
      status: "APPROVED",
      note: `${rec.note || ""} [APPROVED: Đã thu hồi ${revokedCount} Passkey cũ]`.trim(),
    })
    .eq("id", rec.id);

  return ok({
    requestId: rec.id,
    userId: rec.user_id,
    status: "APPROVED",
    revokedPasskeysCount: revokedCount,
    resetToken,
    isSimulated: true,
    message: `Đã duyệt yêu cầu khôi phục, thu hồi ${revokedCount} Passkey cũ và cho phép cấp lại Passkey mới.`,
  });
});
