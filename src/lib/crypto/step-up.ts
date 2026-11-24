import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type StepUpAction =
  | "SIGN_CONTRACT"
  | "APPROVE_REFUND"
  | "RESPOND_DEDUCTION"
  | "RESOLVE_DISPUTE"
  | "EXTEND_DUE";

export async function createStepUpSession(
  db: SupabaseClient,
  userId: string,
  action: StepUpAction,
): Promise<{ stepUpToken: string; expiresAt: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  await db.from("auth_challenges").insert({
    user_id: userId,
    challenge: token,
    type: "STEP_UP",
    action: action,
    expires_at: expiresAt,
  });

  return { stepUpToken: token, expiresAt };
}

export async function requireStepUp(
  request: Request,
  userId: string,
  action: StepUpAction,
): Promise<void> {
  const admin = createAdminSupabase();

  // 1. Check header
  let tokenToVerify = request.headers.get("x-step-up-token");

  // In DEMO_MODE, support demo bypass token
  if (process.env.DEMO_MODE === "true" && tokenToVerify === "demo-step-up") {
    return;
  }

  // 2. If not in header, attempt to inspect body for stepUpToken if JSON
  if (!tokenToVerify) {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body && typeof body.stepUpToken === "string") {
        tokenToVerify = body.stepUpToken;
      }
    } catch {
      // Body is not JSON or cannot be cloned
    }
  }

  if (process.env.DEMO_MODE === "true" && tokenToVerify === "demo-step-up") {
    return;
  }

  if (!tokenToVerify) {
    throw new ApiError(
      "FORBIDDEN",
      { stepUpRequired: true, action },
      "Yêu cầu xác thực bảo mật (Passkey hoặc OTP) cho hành động này.",
    );
  }

  // 3. Verify single-use step-up token:
  // - Must belong to exact userId
  // - Must match EXACT action
  // - Must not be expired
  const now = new Date().toISOString();
  const { data: challenge } = await admin
    .from("auth_challenges")
    .select("id, action, user_id, expires_at")
    .eq("user_id", userId)
    .eq("type", "STEP_UP")
    .eq("action", action)
    .eq("challenge", tokenToVerify)
    .gt("expires_at", now)
    .maybeSingle();

  if (!challenge) {
    throw new ApiError(
      "FORBIDDEN",
      { stepUpRequired: true, action },
      "Mã xác thực bảo mật không hợp lệ, sai hành động hoặc đã hết hạn.",
    );
  }

  // 4. Consume immediately - single-use only! (Prevents token replay)
  const { error } = await admin
    .from("auth_challenges")
    .delete()
    .eq("id", challenge.id);

  if (error) {
    throw new ApiError("INTERNAL_ERROR", undefined, "Không thể xác thực phiên bảo mật.");
  }
}
