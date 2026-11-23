/**
 * Khóa an toàn: đảm bảo mọi thao tác test DB, reset hoặc seed
 * CHỈ ĐƯỢC PHÉP chạy trên local Supabase (127.0.0.1 hoặc localhost).
 * Nếu trỏ tới remote / production URL, dừng ngay lập tức với lỗi rõ ràng.
 */
export function assertLocalDatabaseOnly(customUrl?: string): void {
  const url = customUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isLocal =
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "0.0.0.0";

    if (!isLocal) {
      throw new Error(
        `[SAFETY LOCK] THAO TÁC BỊ CHẶN: Kiểm thử ghi/reset/seed DB chỉ được phép chạy trên Supabase local (127.0.0.1 hoặc localhost). URL hiện tại: ${url}`,
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("[SAFETY LOCK]")) {
      throw err;
    }
    throw new Error(
      `[SAFETY LOCK] URL Supabase không hợp lệ: "${url}". Phải trỏ tới 127.0.0.1 hoặc localhost khi chạy test.`,
    );
  }
}

// Tự động kiểm tra ngay khi file setup được import trong môi trường test
assertLocalDatabaseOnly();
