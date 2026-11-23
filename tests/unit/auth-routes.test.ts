import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { POST as demoSeedPost } from "@/app/api/demo/seed/route";
import { POST as demoResetPost } from "@/app/api/demo/reset/route";
import { POST as otpRequestPost } from "@/app/api/auth/otp/request/route";
import { POST as otpVerifyPost } from "@/app/api/auth/otp/verify/route";
import { POST as recoveryRequestPost } from "@/app/api/recovery/request/route";
import { requireStepUp, createStepUpSession } from "@/lib/crypto/step-up";
import { createAdminSupabase } from "@/lib/supabase/admin";

describe("API Routes & Step-Up Security", () => {
  it("GET /api/health returns database: ok", async () => {
    const res = await healthGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("ok");
    expect(json.data.database).toBe("ok");
  });

  it("POST /api/demo/seed seeds demo landlord, tenants and contracts", async () => {
    const res = await demoSeedPost(new Request("http://localhost:3000/api/demo/seed", { method: "POST" }), {});
    const json = await res.json();
    if (res.status !== 200) console.log("SEED ERROR:", json.error);

    expect(res.status).toBe(200);
    expect(json.data.seeded).toBe(true);
    expect(json.data.landlord).toBe("0900000001");
    expect(json.data.tenant1).toBe("0900000002");
    expect(json.data.tenant2).toBe("0900000003");
    expect(json.data.contractsCount).toBe(3);
  });

  it("POST /api/demo/reset resets data and re-seeds", async () => {
    const res = await demoResetPost(new Request("http://localhost:3000/api/demo/reset", { method: "POST" }), {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.reset).toBe(true);
    expect(json.data.contractsCount).toBe(3);
  });

  it("POST /api/demo/{seed,reset} returns 404 when DEMO_MODE !== 'true'", async () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "false";

    try {
      const resSeed = await demoSeedPost(new Request("http://localhost:3000/api/demo/seed", { method: "POST" }), {});
      expect(resSeed.status).toBe(404);

      const resReset = await demoResetPost(new Request("http://localhost:3000/api/demo/reset", { method: "POST" }), {});
      expect(resReset.status).toBe(404);
    } finally {
      process.env.DEMO_MODE = prev;
    }
  });

  it("POST /api/auth/otp/request returns demo simulated message", async () => {
    const admin = createAdminSupabase();
    const phone = "0900000099";
    await admin.from("auth_otps").delete().eq("phone", phone);

    const req = new Request("http://localhost:3000/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, role: "LANDLORD" }),
    });

    const res = await otpRequestPost(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(json.data.phone).toBe(phone);
    expect(json.data.isDemo).toBe(true);
  });

  it("POST /api/auth/otp/verify verifies demo landlord and returns user session", async () => {
    const phone = "0900000001";
    const req = new Request("http://localhost:3000/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code: "123456", role: "LANDLORD" }),
    });

    const res = await otpVerifyPost(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.user).toBeDefined();
    expect(json.data.user.phone).toBe(phone);
    expect(json.data.user.role).toBe("LANDLORD");
  });

  it("POST /api/recovery/request records simulated recovery request", async () => {
    const phone = "0900000001";
    const req = new Request("http://localhost:3000/api/recovery/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, note: "Mất thiết bị chứa Passkey" }),
    });

    const res = await recoveryRequestPost(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.requestId).toBeDefined();
    expect(json.data.status).toBe("PENDING");
    expect(json.data.isSimulated).toBe(true);
  });

  it("requireStepUp enforces step-up authorization on critical actions", async () => {
    const admin = createAdminSupabase();
    const userId = "00000000-0000-0000-0000-000000000001";

    // 1. Without token: should throw ApiError(FORBIDDEN)
    const reqWithoutToken = new Request("http://localhost:3000/api/test", { method: "POST" });
    await expect(requireStepUp(reqWithoutToken, userId, "SIGN_CONTRACT")).rejects.toThrow();

    // 2. With demo bypass token in DEMO_MODE: should succeed
    const reqWithDemoToken = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "x-step-up-token": "demo-step-up" },
    });
    await expect(requireStepUp(reqWithDemoToken, userId, "SIGN_CONTRACT")).resolves.toBeUndefined();

    // 3. With real step-up session token: should succeed
    const { stepUpToken } = await createStepUpSession(admin, userId, "APPROVE_REFUND");
    const reqWithRealToken = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "x-step-up-token": stepUpToken },
    });
    await expect(requireStepUp(reqWithRealToken, userId, "APPROVE_REFUND")).resolves.toBeUndefined();

    // 4. Token cannot be reused (consumed)
    await expect(requireStepUp(reqWithRealToken, userId, "APPROVE_REFUND")).rejects.toThrow();
  });
});
