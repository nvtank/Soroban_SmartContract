import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/domain/dto";
import { findDemoUserById } from "./demo-accounts";

/**
 * Phiên đăng nhập của RentFlow: cookie httpOnly do server ký HMAC-SHA256.
 * Client không thể tự tạo hay sửa uid/role vì không biết SESSION_SECRET.
 */
export const DEMO_SESSION_COOKIE = "rentflow_session";
/** Cookie cũ không ký, chỉ để xóa khi đăng nhập/đăng xuất. Tuyệt đối không đọc. */
export const LEGACY_DEMO_COOKIES = ["rentflow_demo_user_id", "rentflow_demo_user_role"] as const;

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ROLES: readonly UserRole[] = ["LANDLORD", "TENANT", "ADMIN_DEMO"];

export type SessionClaims = { uid: string; role: UserRole; exp: number };

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Ký phiên cho người dùng đã xác thực (OTP hoặc Passkey). Trả null khi thiếu secret. */
export function createSessionToken(uid: string, role: UserRole, nowMs = Date.now()): string | null {
  const secret = sessionSecret();
  if (!secret || !ROLES.includes(role)) return null;
  const claims: SessionClaims = { uid, role, exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

/** Đăng nhập nhanh: chỉ khi DEMO_MODE=true và chỉ với tài khoản trong allowlist demo. */
export function createDemoSessionToken(userId: string, nowMs = Date.now()): string | null {
  if (process.env.DEMO_MODE !== "true") return null;
  const account = findDemoUserById(userId);
  return account ? createSessionToken(account.id, account.role, nowMs) : null;
}

export function verifySessionToken(token: string | undefined | null, nowMs = Date.now()): SessionClaims | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(secret, payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims.uid !== "string" || !ROLES.includes(claims.role) || typeof claims.exp !== "number") return null;
  if (claims.exp * 1000 <= nowMs) return null;

  // Tài khoản demo chỉ hợp lệ khi đang bật DEMO_MODE.
  if (findDemoUserById(claims.uid) && process.env.DEMO_MODE !== "true") return null;
  return claims;
}

/** Giữ tên cũ mà các module hiện có đang import. */
export const verifyDemoSessionToken = verifySessionToken;

export function demoSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
