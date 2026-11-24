import { z } from "zod";
import { withApi, parseJson, ok, ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

const EkycSimulateSchema = z.object({
  requestId: z.string().uuid(),
  idCardNumber: z.string().optional(),
  biometricMatchSimulated: z.boolean().default(true),
});

export const POST = withApi(async (request: Request) => {
  const body = await parseJson(request, EkycSimulateSchema);
  const admin = createAdminSupabase();

  const { data: rec } = await admin
    .from("recovery_requests")
    .select("id, user_id, phone, status, note")
    .eq("id", body.requestId)
    .maybeSingle();

  if (!rec) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy yêu cầu khôi phục.");
  }

  if (rec.status !== "PENDING") {
    throw new ApiError("VALIDATION_ERROR", undefined, `Yêu cầu khôi phục ở trạng thái '${rec.status}', không thể thực hiện eKYC.`);
  }

  // Update note with eKYC simulated completion
  const updatedNote = `${rec.note || ""} [EKYC_VERIFIED: Khớp 99.2% mô phỏng]`.trim();
  await admin
    .from("recovery_requests")
    .update({ note: updatedNote })
    .eq("id", rec.id);

  return ok({
    requestId: rec.id,
    ekycVerified: true,
    isSimulated: true,
    status: "PENDING",
    message: "Hoàn tất xác thực eKYC mô phỏng. Yêu cầu đã được chuyển tới Ban Quản trị demo để phê duyệt và thu hồi Passkey cũ.",
  });
});
