import { cookies } from "next/headers";
import type { SessionUser } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import { touchActivity } from "@/lib/admin/server/activity";
import { createServerSupabase } from "./server";
import { createAdminSupabase } from "./admin";
import { DEMO_SESSION_COOKIE, verifyDemoSessionToken } from "./demo-session";

export async function getOptionalUser(): Promise<SessionUser | null> {
  const admin = createAdminSupabase();

  // 1. Check standard Supabase session
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, role, full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          role: profile.role,
          fullName: profile.full_name,
          phone: profile.phone,
        };
      }

      return {
        id: user.id,
        role: "TENANT",
        fullName: user.user_metadata?.full_name ?? null,
        phone: user.phone ?? null,
      };
    }
  } catch {
    // Proceed to check fallback/demo headers
  }

  // 2. Phiên RentFlow: cookie do server ký HMAC sau khi xác thực OTP/Passkey.
  // Tài khoản demo chỉ hợp lệ khi DEMO_MODE=true (kiểm tra trong verifyDemoSessionToken).
  // Cookie hoặc header không ký KHÔNG bao giờ được tin.
  try {
    const cookieStore = await cookies();
    const session = verifyDemoSessionToken(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
    if (session) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, role, full_name, phone")
        .eq("id", session.uid)
        .maybeSingle();

      // Vai trò trong DB phải khớp vai trò đã ký
      if (profile && profile.role === session.role) {
        return {
          id: profile.id,
          role: profile.role,
          fullName: profile.full_name,
          phone: profile.phone,
        };
      }
    }
  } catch {
    // Ngoài ngữ cảnh request
  }

  return null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getOptionalUser();
  if (!user) {
    throw new ApiError("UNAUTHENTICATED");
  }
  await touchActivity(user.id);
  return user;
}
