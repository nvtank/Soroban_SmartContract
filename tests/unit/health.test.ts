import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";

describe("Health Check API (/api/health)", () => {
  it("checks database, stellar RPC, and payOS without leaking internal details", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.status).toBe("ok");
    expect(json.data.database).toBe("ok");
    expect(json.data.stellarRpc).toBeDefined();
    expect(json.data.payos).toBeDefined();
    expect(json.data.services).toEqual({
      database: json.data.database,
      stellarRpc: json.data.stellarRpc,
      payos: json.data.payos,
    });

    // Verify NO internal secrets or connection details leaked
    const rawJson = JSON.stringify(json);
    expect(rawJson).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(rawJson).not.toContain("CUSTODY_MASTER_KEY");
    expect(rawJson).not.toContain("PAYOS_API_KEY");
    expect(rawJson).not.toContain("PAYOS_CHECKSUM_KEY");
    expect(rawJson).not.toContain("postgres://");
    expect(rawJson).not.toContain("Error:");
    expect(rawJson).not.toContain("stack");
  });

  it("reflects simulated payos status when PAYMENT_MODE is simulated", async () => {
    const originalMode = process.env.PAYMENT_MODE;
    try {
      process.env.PAYMENT_MODE = "simulated";
      const res = await healthGet();
      const json = await res.json();

      expect(json.data.payos).toBe("simulated");
      expect(json.data.services.payos).toBe("simulated");
    } finally {
      process.env.PAYMENT_MODE = originalMode;
    }
  });

  it("handles unreachable stellar RPC gracefully without crashing", async () => {
    const originalRpc = process.env.STELLAR_RPC_URL;
    try {
      // Point to an invalid unreachable port
      process.env.STELLAR_RPC_URL = "http://127.0.0.1:19999";
      const res = await healthGet();
      const json = await res.json();

      expect(res.status).toBe(200); // Overall health still ok because DB is ok
      expect(json.data.stellarRpc).toBe("unreachable");
    } finally {
      process.env.STELLAR_RPC_URL = originalRpc;
    }
  });
});
