import { cookies } from "next/headers";
import type { UserRole } from "@/domain/dto";
import {
  DEMO_SESSION_COOKIE,
  LEGACY_DEMO_COOKIES,
  createDemoSessionToken,
  createSessionToken,
  demoSessionCookieOptions,
} from "./demo-session";

async function writeSessionCookie(token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const store = await cookies();
    store.set(DEMO_SESSION_COOKIE, token, demoSessionCookieOptions());
    for (const legacy of LEGACY_DEMO_COOKIES) store.delete(legacy);
    return true;
  } catch {
    // Ngoài ngữ cảnh request (unit test)
    return false;
  }
}

/** Đặt phiên sau khi server đã xác thực người dùng bằng OTP hoặc Passkey. */
export async function setSessionCookie(userId: string, role: UserRole): Promise<boolean> {
  return writeSessionCookie(createSessionToken(userId, role));
}

/**
 * Đăng nhập nhanh tài khoản demo. Trả false (không đặt gì) nếu DEMO_MODE tắt,
 * tài khoản không thuộc allowlist demo, thiếu secret hoặc không ở ngữ cảnh request.
 */
export async function setDemoSessionCookie(userId: string): Promise<boolean> {
  return writeSessionCookie(createDemoSessionToken(userId));
}

export async function clearDemoSessionCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(DEMO_SESSION_COOKIE);
    for (const legacy of LEGACY_DEMO_COOKIES) store.delete(legacy);
  } catch {
    // Ngoài ngữ cảnh request
  }
}
