import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/http";

/**
 * Trích xuất an toàn địa chỉ IP của client từ Request hoặc Headers.
 * KHÔNG tin x-forwarded-for một cách mù quáng:
 * - Kiểm tra các header tin cậy trước: x-vercel-forwarded-for, cf-connecting-ip, x-real-ip
 * - Với x-forwarded-for: chỉ lấy phần tử đầu tiên, loại bỏ khoảng trắng, kiểm tra định dạng IPv4 / IPv6 hợp lệ.
 * - Loại bỏ port (nếu có) và chặn các ký tự bất thường / injection.
 */
export function getClientIp(requestOrHeaders: Request | Headers): string {
  const headers = requestOrHeaders instanceof Request ? requestOrHeaders.headers : requestOrHeaders;

  // 1. Kiểm tra header từ các reverse proxy tin cậy
  const trustedHeaders = [
    "x-vercel-forwarded-for",
    "cf-connecting-ip",
    "x-real-ip",
  ];

  for (const name of trustedHeaders) {
    const val = headers.get(name);
    if (val) {
      const candidate = sanitizeIp(val.trim());
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  // 2. Kiểm tra x-forwarded-for (có thể chứa danh sách phân tách bằng dấu phẩy)
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim());
    for (const rawIp of ips) {
      const candidate = sanitizeIp(rawIp);
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  return "127.0.0.1";
}

function sanitizeIp(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith("[") && clean.includes("]")) {
    const match = clean.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
    if (match) clean = match[1];
  } else if (clean.includes(":") && clean.indexOf(":") === clean.lastIndexOf(":")) {
    clean = clean.split(":")[0];
  }
  return clean;
}

export function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;

  // IPv4 check: 4 octets 0-255
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const v4Match = ip.match(ipv4Regex);
  if (v4Match) {
    for (let i = 1; i <= 4; i++) {
      const num = parseInt(v4Match[i], 10);
      if (num < 0 || num > 255) return false;
      if (v4Match[i].length > 1 && v4Match[i].startsWith("0")) return false;
    }
    return true;
  }

  // IPv6 check
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}:?([0-9a-fA-F]{1,4})?$/;
  if (ip === "::1" || ipv6Regex.test(ip)) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra và tăng giới hạn tần suất bền vững qua DB Postgres (hoạt động đa instance serverless).
 */
export async function checkRateLimit(
  db: SupabaseClient,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (!error && typeof data === "boolean") {
      return data;
    }

    // Fallback: direct table upsert if RPC fails
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();

    const { data: existing } = await db
      .from("rate_limits")
      .select("count, expires_at")
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      const isExpired = new Date(existing.expires_at).getTime() <= now.getTime();
      const newCount = isExpired ? 1 : existing.count + 1;
      const newExpiresAt = isExpired ? expiresAt : existing.expires_at;

      await db
        .from("rate_limits")
        .update({ count: newCount, expires_at: newExpiresAt })
        .eq("key", key);

      return newCount <= maxRequests;
    } else {
      await db.from("rate_limits").insert({
        key,
        count: 1,
        expires_at: expiresAt,
      });
      return true;
    }
  } catch (err) {
    console.warn("[rate-limit] Check failed, falling back to permissive:", err);
    return true;
  }
}

/**
 * Kiểm tra rate limit, ném ApiError("RATE_LIMITED") nếu vi phạm.
 */
export async function assertRateLimit(
  db: SupabaseClient,
  key: string,
  maxRequests: number,
  windowSeconds: number,
  message = "Bạn thao tác quá nhanh, vui lòng thử lại sau.",
): Promise<void> {
  const allowed = await checkRateLimit(db, key, maxRequests, windowSeconds);
  if (!allowed) {
    throw new ApiError("RATE_LIMITED", undefined, message);
  }
}
