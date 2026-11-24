import { ApiError } from "@/lib/api/http";
import type { SessionUser } from "@/domain/dto";
import {
  requireUser as defaultRequireUser,
  getOptionalUser as defaultGetOptionalUser,
} from "@/lib/supabase/session";

export interface AuthDeps {
  requireUser?: () => Promise<SessionUser>;
  getOptionalUser?: () => Promise<SessionUser | null>;
}

let injectedAuth: AuthDeps | null = null;

/**
 * Dependency injection dành riêng cho kiểm thử tự động (Unit / Integration test).
 * Giúp tiêm danh tính người dùng mà không phụ thuộc vào header giả.
 */
export function setInjectedAuth(deps: AuthDeps | null): void {
  injectedAuth = deps;
}

/**
 * Lấy thông tin người dùng từ phiên đăng nhập Supabase.
 *
 * P0 BẢO MẬT (TASK mục 1):
 * - TUYỆT ĐỐI KHÔNG đọc danh tính từ bất kỳ request header nào (x-user-id, x-user-role, ...).
 * - CHỈ tin tưởng requireUser() / getOptionalUser() từ @/lib/supabase/session.
 * - Hỗ trợ dependency injection qua setInjectedAuth() cho kiểm thử.
 */
export async function getSessionUser(
  _request?: Request,
  required = true,
  deps?: AuthDeps,
): Promise<SessionUser | null> {
  const activeAuth = deps ?? injectedAuth;
  const requireUserFn = activeAuth?.requireUser ?? defaultRequireUser;
  const getOptionalUserFn = activeAuth?.getOptionalUser ?? defaultGetOptionalUser;

  if (required) {
    try {
      return await requireUserFn();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("UNAUTHENTICATED", undefined, "Vui lòng đăng nhập để tiếp tục.");
    }
  }

  try {
    return await getOptionalUserFn();
  } catch {
    return null;
  }
}

