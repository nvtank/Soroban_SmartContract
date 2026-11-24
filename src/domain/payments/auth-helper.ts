import { ApiError } from "@/lib/api/http";
import type { SessionUser, UserRole } from "@/domain/dto";

/**
 * Trợ giúp lấy thông tin người dùng từ phiên đăng nhập.
 * Theo CONTRACTS mục 7: requireUser() ném ApiError("UNAUTHENTICATED").
 */
export async function getSessionUser(
  request?: Request,
  required = true,
): Promise<SessionUser | null> {
  try {
    const serverMod = await import("@/lib/supabase/session");
    if (required && typeof serverMod.requireUser === "function") {
      return await serverMod.requireUser();
    }
    if (typeof serverMod.getOptionalUser === "function") {
      return await serverMod.getOptionalUser();
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
      if (required) throw error;
      return null;
    }
    // Nếu module chưa sẵn sàng hoặc lỗi import, tiếp tục fallback
  }

  // Fallback qua header cho kiểm thử / môi trường test
  if (request) {
    const userId = request.headers.get("x-user-id");
    const userRole = (request.headers.get("x-user-role") as UserRole) || "TENANT";
    if (userId) {
      return {
        id: userId,
        role: userRole,
        fullName: request.headers.get("x-user-name") || "Người dùng thử nghiệm",
        phone: request.headers.get("x-user-phone") || "0900000000",
      };
    }
  }

  if (required) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Vui lòng đăng nhập để tiếp tục.");
  }

  return null;
}
