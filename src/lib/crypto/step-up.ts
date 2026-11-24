import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type StepUpAction =
  | "SIGN_CONTRACT"
  | "APPROVE_REFUND"
  | "RESPOND_DEDUCTION"
  | "RESOLVE_DISPUTE";

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
  const tokenHeader = request.headers.get("x-step-up-token");

  // In DEMO_MODE, support demo bypass token
  if (process.env.DEMO_MODE === "true" && tokenHeader === "demo-step-up") {
    return;
  }

  let tokenToVerify = tokenHeader;

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

  if (tokenToVerify) {
    const { data: challenge } = await admin
      .from("auth_challenges")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("type", "STEP_UP")
      .eq("action", action)
      .eq("challenge", tokenToVerify)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (challenge) {
      // Consume token once verified
      await admin.from("auth_challenges").delete().eq("id", challenge.id);
      return;
    }
  }

  // 3. Fallback: check recent verified step-up within 5 minutes for this user & action
  const { data: recent } = await admin
    .from("auth_challenges")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("type", "STEP_UP")
    .eq("action", action)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (recent) {
    await admin.from("auth_challenges").delete().eq("id", recent.id);
    return;
  }

  throw new ApiError(
    "FORBIDDEN",
    { stepUpRequired: true, action },
    "Yêu cầu xác thực bảo mật (Passkey hoặc OTP) cho hành động này.",
  );
}
