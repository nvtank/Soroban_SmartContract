import { describe, expect, it } from "vitest";
import { assertLocalDatabaseOnly } from "@/../tests/safety";

describe("Safety Lock: Database Protection in Tests", () => {
  it("allows local IP and localhost endpoints", () => {
    expect(() => assertLocalDatabaseOnly("http://127.0.0.1:54421")).not.toThrow();
    expect(() => assertLocalDatabaseOnly("http://localhost:54421")).not.toThrow();
    expect(() => assertLocalDatabaseOnly("http://0.0.0.0:54421")).not.toThrow();
  });

  it("BLOCKS remote / non-local Supabase URLs with clear safety lock error", () => {
    const remoteUrls = [
      "https://xyzcompany.supabase.co",
      "https://api.rentflow.vn",
      "http://192.168.1.50:54321",
      "https://production-db.supabase.in",
    ];

    for (const url of remoteUrls) {
      expect(() => assertLocalDatabaseOnly(url)).toThrow(
        /\[SAFETY LOCK\] THAO TÁC BỊ CHẶN/i,
      );
    }
  });

  it("BLOCKS malformed URLs", () => {
    expect(() => assertLocalDatabaseOnly("not-a-valid-url")).toThrow(
      /\[SAFETY LOCK\]/i,
    );
  });
});
