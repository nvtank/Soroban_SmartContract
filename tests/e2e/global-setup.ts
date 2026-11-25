import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

/** Đọc một biến từ .env.local (chỉ môi trường local). */
function envLocal(name: string): string {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const match = content.match(new RegExp(`^${name}=(.*)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

/**
 * Bộ E2E đăng nhập rất nhiều lần từ cùng một IP, nên nhanh chóng chạm giới hạn
 * "20 lần xác thực OTP mỗi 5 phút" (tính năng chống dò mã, hoạt động đúng).
 * Dọn bộ đếm giới hạn trước mỗi lần chạy. Chỉ làm với database localhost.
 */
export default async function globalSetup() {
  // Ưu tiên biến môi trường của lần chạy (ví dụ đang trỏ Supabase local), rồi mới tới .env.local
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal("SUPABASE_SERVICE_ROLE_KEY");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url) || !key) return;
  const db = createClient(url, key);
  for (const prefix of ["otp:%", "rec:%"]) {
    await db.from("rate_limits").delete().like("key", prefix);
  }
}
