import { z } from "zod";
import { auditSession } from "@/lib/admin/server/activity";
import { demoAdminPasswordConfig, matchesDemoAdminPassword } from "@/lib/admin/server/password";
import { ApiError, ok, parseJson, withApi } from "@/lib/api/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { setSessionCookie } from "@/lib/supabase/demo-session-cookie";
import { getClientIp } from "@/lib/supabase/rate-limit";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const POST = withApi(async (request: Request) => {
  const config = demoAdminPasswordConfig();
  if (!config) throw new ApiError("NOT_FOUND");

  const { username, password } = await parseJson(request, credentialsSchema);
  const db = createAdminSupabase();
  const limit = await db.rpc("check_rate_limit", {
    p_key: `admin:password:ip:${getClientIp(request)}`,
    p_max_requests: 10,
    p_window_seconds: 300,
  });
  if (limit.error || typeof limit.data !== "boolean") throw new ApiError("INTERNAL_ERROR");
  if (!limit.data) throw new ApiError("RATE_LIMITED");

  const valid = await matchesDemoAdminPassword(config, password);
  if (!valid || username !== "admin") {
    throw new ApiError("UNAUTHENTICATED", undefined, "Tên tài khoản hoặc mật khẩu không đúng.");
  }

  const { data: profile, error } = await db
    .from("profiles")
    .select("id, role")
    .eq("phone", "0900000004")
    .maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR");
  if (profile?.role !== "ADMIN_DEMO") throw new ApiError("FORBIDDEN");
  if (!(await setSessionCookie(profile.id, "ADMIN_DEMO"))) throw new ApiError("INTERNAL_ERROR");

  await auditSession(profile.id, "LOGIN");
  return ok({ user: { role: "ADMIN_DEMO" } });
});
