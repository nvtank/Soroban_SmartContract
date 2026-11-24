import "@/../tests/setup";
import { describe, expect, it } from "vitest";
import { getWebAuthnConfig } from "@/lib/crypto/passkey";
import { createStepUpSession, requireStepUp } from "@/lib/crypto/step-up";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api/http";

describe("Passkey WebAuthn & Step-Up Security", () => {
  const admin = createAdminSupabase();

  describe("WebAuthn Configuration & RP Details", () => {
    it("provides valid WebAuthn relying party configuration", () => {
      const config = getWebAuthnConfig();

      expect(config.rpName).toBeDefined();
      expect(config.rpID).toBeDefined();
      expect(config.origin).toBeDefined();

      expect(typeof config.rpName).toBe("string");
      expect(typeof config.rpID).toBe("string");
      expect(typeof config.origin).toBe("string");
      expect(config.origin.startsWith("http://") || config.origin.startsWith("https://")).toBe(true);
    });
  });

  describe("Single-Use Step-Up & Exact Action Binding", () => {
    const testUserId = "00000000-0000-0000-0000-000000000001";
    const otherUserId = "00000000-0000-0000-0000-000000000002";

    it("succeeds once, then immediately rejects replay of the same step-up token", async () => {
      const { stepUpToken } = await createStepUpSession(
        admin,
        testUserId,
        "SIGN_CONTRACT",
      );

      const request1 = new Request("http://localhost:3000/api/contracts/c1/confirm", {
        headers: {
          "x-step-up-token": stepUpToken,
        },
      });

      // First call: succeeds
      await expect(requireStepUp(request1, testUserId, "SIGN_CONTRACT")).resolves.toBeUndefined();

      // Second call with same token: MUST fail (single use / anti-replay)
      const request2 = new Request("http://localhost:3000/api/contracts/c1/confirm", {
        headers: {
          "x-step-up-token": stepUpToken,
        },
      });

      await expect(requireStepUp(request2, testUserId, "SIGN_CONTRACT")).rejects.toThrow(ApiError);
    });

    it("REJECTS step-up token when action does not match the token's bound action", async () => {
      const { stepUpToken } = await createStepUpSession(
        admin,
        testUserId,
        "SIGN_CONTRACT",
      );

      const request = new Request("http://localhost:3000/api/contracts/c1/refund/approve", {
        headers: {
          "x-step-up-token": stepUpToken,
        },
      });

      // Token created for SIGN_CONTRACT must fail for APPROVE_REFUND
      await expect(
        requireStepUp(request, testUserId, "APPROVE_REFUND"),
      ).rejects.toThrow(/Mã xác thực bảo mật không hợp lệ, sai hành động/i);

      // Clean up challenge if not consumed
      await admin.from("auth_challenges").delete().eq("challenge", stepUpToken);
    });

    it("REJECTS step-up token when used by a different user", async () => {
      const { stepUpToken } = await createStepUpSession(
        admin,
        testUserId,
        "SIGN_CONTRACT",
      );

      const request = new Request("http://localhost:3000/api/contracts/c1/confirm", {
        headers: {
          "x-step-up-token": stepUpToken,
        },
      });

      // Token created for testUserId must fail when submitted by otherUserId
      await expect(
        requireStepUp(request, otherUserId, "SIGN_CONTRACT"),
      ).rejects.toThrow(ApiError);

      await admin.from("auth_challenges").delete().eq("challenge", stepUpToken);
    });

    it("REJECTS expired step-up tokens", async () => {
      // Insert challenge with expired timestamp
      const expiredToken = "expired-token-12345";
      await admin.from("auth_challenges").insert({
        user_id: testUserId,
        challenge: expiredToken,
        type: "STEP_UP",
        action: "SIGN_CONTRACT",
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute in the past
      });

      const request = new Request("http://localhost:3000/api/contracts/c1/confirm", {
        headers: {
          "x-step-up-token": expiredToken,
        },
      });

      await expect(
        requireStepUp(request, testUserId, "SIGN_CONTRACT"),
      ).rejects.toThrow(ApiError);

      await admin.from("auth_challenges").delete().eq("challenge", expiredToken);
    });

    it("requires token when none is provided", async () => {
      const requestWithoutToken = new Request("http://localhost:3000/api/contracts/c1/confirm");

      await expect(
        requireStepUp(requestWithoutToken, testUserId, "SIGN_CONTRACT"),
      ).rejects.toThrow(/Yêu cầu xác thực bảo mật/i);
    });
  });
});
