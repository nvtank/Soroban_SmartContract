import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);

/**
 * Chấp nhận các lỗi dán thường gặp khi đặt biến trên Vercel: dấu cách hoặc xuống dòng,
 * dấu nháy bao quanh, hoặc dán cả "DEMO_ADMIN_PASSWORD_HASH=" vào ô giá trị.
 */
export function normalizeHashValue(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^DEMO_ADMIN_PASSWORD_HASH\s*=\s*/i, "")
    .replace(/^["'](.*)["']$/s, "$1")
    .replace(/\s+/g, "");
}

export function demoAdminPasswordConfig() {
  if (process.env.DEMO_MODE !== "true") return null;
  const match = /^([0-9a-f]{32}):([0-9a-f]{64})$/i.exec(
    normalizeHashValue(process.env.DEMO_ADMIN_PASSWORD_HASH),
  );
  return match ? { salt: Buffer.from(match[1], "hex"), hash: Buffer.from(match[2], "hex") } : null;
}

export async function matchesDemoAdminPassword(
  config: NonNullable<ReturnType<typeof demoAdminPasswordConfig>>,
  password: string,
) {
  const candidate = (await derive(password, config.salt, config.hash.length)) as Buffer;
  return timingSafeEqual(candidate, config.hash);
}
