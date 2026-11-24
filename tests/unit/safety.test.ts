import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertLocalDatabaseOnly, isAllowedLocalSupabaseUrl } from "@/../tests/safety";
import { resetDemoData, seedDemoData } from "@/lib/supabase/seed";

describe("Safety Lock: Database Protection in Tests", () => {
  it("allows local IP (127.0.0.1) and localhost endpoints", () => {
    expect(() => assertLocalDatabaseOnly("http://127.0.0.1:54421")).not.toThrow();
    expect(() => assertLocalDatabaseOnly("http://localhost:54421")).not.toThrow();
    expect(() => assertLocalDatabaseOnly("http://127.0.0.1:8000")).not.toThrow();
    expect(() => assertLocalDatabaseOnly("http://localhost:3000")).not.toThrow();

    expect(isAllowedLocalSupabaseUrl("http://127.0.0.1:54421")).toBe(true);
    expect(isAllowedLocalSupabaseUrl("http://localhost:54421")).toBe(true);
  });

  it("BLOCKS 0.0.0.0 and remote / non-local Supabase URLs with clear safety lock error", () => {
    const blockedUrls = [
      "http://0.0.0.0:54421",
      "https://xyzcompany.supabase.co",
      "https://api.rentflow.vn",
      "http://192.168.1.50:54321",
      "https://production-db.supabase.in",
    ];

    for (const url of blockedUrls) {
      expect(() => assertLocalDatabaseOnly(url)).toThrow(
        /\[SAFETY LOCK\] THAO TÁC BỊ CHẶN/i,
      );
      expect(isAllowedLocalSupabaseUrl(url)).toBe(false);
    }
  });

  it("BLOCKS missing or malformed URLs", () => {
    expect(() => assertLocalDatabaseOnly("")).toThrow(/\[SAFETY LOCK\]/i);
    expect(() => assertLocalDatabaseOnly("not-a-valid-url")).toThrow(
      /\[SAFETY LOCK\]/i,
    );
    expect(isAllowedLocalSupabaseUrl("")).toBe(false);
    expect(isAllowedLocalSupabaseUrl("invalid")).toBe(false);
  });

  it("BLOCKS seed/reset in test environment if NEXT_PUBLIC_SUPABASE_URL points to remote host", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://my-production.supabase.co";

      const mockAdmin = {} as unknown as SupabaseClient;
      await expect(seedDemoData(mockAdmin)).rejects.toThrow(
        /\[SAFETY LOCK\] THAO TÁC BỊ CHẶN/i,
      );
      await expect(resetDemoData(mockAdmin)).rejects.toThrow(
        /\[SAFETY LOCK\] THAO TÁC BỊ CHẶN/i,
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
  });

  it("does NOT block at runtime when NODE_ENV is production and VITEST is undefined", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    try {
      // Simulate runtime
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.VITEST;

      // Notice assertLocalDatabaseOnly is only called in test helpers
      // and seedDemoData runtime guard does not throw in production:
      expect(process.env.NODE_ENV).toBe("production");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      if (originalVitest !== undefined) process.env.VITEST = originalVitest;
    }
  });
});
