import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api/http";
import { getOptionalUser } from "@/lib/supabase/session";
import { DEMO_SESSION_COOKIE, verifyDemoSessionToken } from "@/lib/supabase/demo-session";

/** So sánh chuỗi bí mật theo thời gian không đổi. minLength chặn bí mật quá ngắn hoặc để trống. */
export function safeEqual(given: string, expected: string, minLength = 1): boolean {
  if (expected.length < minLength) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Kiểm tra quyền truy cập các route demo nguy hiểm (/api/demo/prepare, /api/demo/reset, /api/demo/seed).
 *
 * Quy tắc bảo vệ:
 * 1. DEMO_MODE khác "true" -> trả 404 (ApiError NOT_FOUND).
 * 2. DEMO_MODE === "true" -> CHỈ cho phép khi:
 *    - Phiên đăng nhập là ADMIN_DEMO
 *    - HOẶC có header Authorization: Bearer <CRON_SECRET> (hoặc x-cron-secret: <CRON_SECRET>).
 * 3. Bất kỳ trường hợp nào khác (khách vãng lai, người thuê TENANT, chủ nhà LANDLORD) -> trả 403 (FORBIDDEN).
 */
export async function assertDemoRouteAccess(request: Request): Promise<void> {
  // 1. DEMO_MODE khác "true" vẫn trả 404 để giấu route demo ngoài môi trường demo
  if (process.env.DEMO_MODE !== "true") {
    throw new ApiError("NOT_FOUND");
  }

  // 2. Kiểm tra header Authorization: Bearer <CRON_SECRET> hoặc x-cron-secret
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const hasValidSecret =
    safeEqual(bearerToken, expectedSecret ?? "", 16) ||
    safeEqual(cronSecretHeader ?? "", expectedSecret ?? "", 16);

  if (hasValidSecret) {
    return;
  }

  // 3. Kiểm tra phiên đăng nhập có vai trò ADMIN_DEMO
  let userRole: string | null = null;
  try {
    const user = await getOptionalUser();
    if (user) {
      userRole = user.role;
    }
  } catch {
    // Ngoài ngữ cảnh Next.js headers/cookies
  }

  // Fallback: giải mã cookie rentflow_session trực tiếp từ Request headers
  if (!userRole) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${DEMO_SESSION_COOKIE}=([^;]+)`));
      if (match?.[1]) {
        const claims = verifyDemoSessionToken(match[1]);
        if (claims) {
          userRole = claims.role;
        }
      }
    }
  }

  if (userRole === "ADMIN_DEMO") {
    return;
  }

  // Ngược lại trả 403 (không phải 404, để người dùng hiểu lý do)
  throw new ApiError(
    "FORBIDDEN",
    undefined,
    "Yêu cầu quyền quản trị viên demo (ADMIN_DEMO) hoặc header Authorization: Bearer <CRON_SECRET>.",
  );
}
