import "@/../tests/setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as recoveryRequestPost } from "@/app/api/recovery/request/route";
import { POST as recoveryVerifyOtpPost } from "@/app/api/recovery/verify-otp/route";
import { POST as recoveryEkycPost } from "@/app/api/recovery/ekyc/route";
import { POST as recoveryApprovePost } from "@/app/api/recovery/approve/route";
import { POST as recoveryReissuePost } from "@/app/api/recovery/reissue/route";
import { GET as recoveryGet } from "@/app/api/recovery/route";
import { createAdminSupabase } from "@/lib/supabase/admin";

describe("Account Recovery Flow (Simulated OTP, eKYC, Admin Approval, Passkey Revocation & Reissue)", () => {
  const admin = createAdminSupabase();
  const originalDemoMode = process.env.DEMO_MODE;

  const testPhone = "0900000002"; // Demo Tenant 1
  let testUserId = "";
  let requestId = "";

  beforeAll(async () => {
    process.env.DEMO_MODE = "true";

    // Ensure test user profile exists
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", testPhone)
      .maybeSingle();

    if (profile) {
      testUserId = profile.id;
    } else {
      testUserId = "00000000-0000-0000-0000-000000000002";
      await admin.from("profiles").upsert({
        id: testUserId,
        phone: testPhone,
        full_name: "Test Tenant Recovery",
        role: "TENANT",
      });
    }

    // Insert dummy passkey credential to prove it gets revoked upon approval
    await admin.from("passkey_credentials").upsert({
      user_id: testUserId,
      credential_id: `test_old_cred_${Date.now()}`,
      public_key: "old_public_key_data",
      counter: 10,
    });
  });

  it("Step 1: POST /api/recovery/request initiates recovery and issues simulated OTP", async () => {
    const req = new Request("http://localhost:3000/api/recovery/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: testPhone,
        note: "Mất điện thoại, cần khôi phục Passkey",
      }),
    });

    const res = await recoveryRequestPost(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("PENDING");
    expect(json.data.isSimulated).toBe(true);
    expect(json.data.requestId).toBeDefined();

    requestId = json.data.requestId;
  });

  it("Step 2: POST /api/recovery/verify-otp verifies OTP for the recovery request", async () => {
    const req = new Request("http://localhost:3000/api/recovery/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestId,
        code: "123456",
      }),
    });

    const res = await recoveryVerifyOtpPost(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.otpVerified).toBe(true);
  });

  it("Step 3: POST /api/recovery/ekyc simulates eKYC verification and updates request", async () => {
    const req = new Request("http://localhost:3000/api/recovery/ekyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestId,
        idCardNumber: "001234567890",
        biometricMatchSimulated: true,
      }),
    });

    const res = await recoveryEkycPost(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.ekycVerified).toBe(true);
  });

  it("Step 4: GET /api/recovery lists pending requests for Admin Demo dashboard", async () => {
    const res = await recoveryGet({} as Request, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);

    const found = json.data.find((r: any) => r.id === requestId);
    expect(found).toBeDefined();
    expect(found.phone).toBe(testPhone);
  });

  it("Step 5: POST /api/recovery/approve revokes old Passkeys and approves request", async () => {
    // Verify old passkey exists before approval
    const { data: beforeCreds } = await admin
      .from("passkey_credentials")
      .select("id")
      .eq("user_id", testUserId);
    expect(beforeCreds && beforeCreds.length > 0).toBe(true);

    const req = new Request("http://localhost:3000/api/recovery/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestId,
      }),
    });

    const res = await recoveryApprovePost(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("APPROVED");
    expect(json.data.revokedPasskeysCount).toBeGreaterThan(0);
    expect(json.data.resetToken).toBeDefined();

    // Verify old passkey credentials have been revoked/deleted
    const { data: afterCreds } = await admin
      .from("passkey_credentials")
      .select("id")
      .eq("user_id", testUserId);
    expect(afterCreds).toHaveLength(0);
  });

  it("Step 6: POST /api/recovery/reissue completes recovery and marks COMPLETED", async () => {
    const req = new Request("http://localhost:3000/api/recovery/reissue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: requestId,
      }),
    });

    const res = await recoveryReissuePost(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("COMPLETED");

    // Check DB status is COMPLETED
    const { data: check } = await admin
      .from("recovery_requests")
      .select("status")
      .eq("id", requestId)
      .single();
    expect(check?.status).toBe("COMPLETED");
  });

  afterAll(async () => {
    process.env.DEMO_MODE = originalDemoMode;
    if (requestId) {
      await admin.from("recovery_requests").delete().eq("id", requestId);
    }
  });
});
