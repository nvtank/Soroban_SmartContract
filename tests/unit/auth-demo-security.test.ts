import "@/../tests/setup";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { assertDemoRouteAccess } from "@/lib/demo/auth";
import { POST as demoPreparePost } from "@/app/api/demo/prepare/route";
import { POST as demoResetPost } from "@/app/api/demo/reset/route";
import { POST as demoSeedPost } from "@/app/api/demo/seed/route";
import { POST as overdueScanPost } from "@/app/api/jobs/overdue-scan/route";
import { POST as otpVerifyPost } from "@/app/api/auth/otp/verify/route";
import { requireStepUp, createStepUpSession } from "@/lib/crypto/step-up";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createSessionToken, DEMO_SESSION_COOKIE } from "@/lib/supabase/demo-session";
import { DEMO_USERS } from "@/lib/supabase/demo-accounts";

// Mock các hàm thực thi nguy hiểm để tuyệt đối KHÔNG xóa hay reset database chung
vi.mock("@/lib/demo/scenario", () => ({
  prepareDemoScenario: vi.fn().mockResolvedValue({
    contracts: [{ id: "mock-contract-1", label: "Phòng mock", story: "Mock story" }],
  }),
}));

vi.mock("@/lib/supabase/seed", () => ({
  resetDemoData: vi.fn().mockResolvedValue({
    users: {
      LANDLORD: { phone: "0900000001" },
      TENANT_1: { phone: "0900000002" },
      TENANT_2: { phone: "0900000003" },
      ADMIN: { phone: "0900000004" },
    },
    contracts: { mock: "mock-contract" },
  }),
  seedDemoData: vi.fn().mockResolvedValue({
    users: {
      LANDLORD: { phone: "0900000001" },
      TENANT_1: { phone: "0900000002" },
      TENANT_2: { phone: "0900000003" },
      ADMIN: { phone: "0900000004" },
    },
    contracts: { mock: "mock-contract" },
  }),
}));

vi.mock("@/domain/jobs/overdue-scan", () => ({
  scanOverdue: vi.fn().mockResolvedValue({ updatedCount: 42 }),
}));

describe("Demo Routes & Security Isolation (Agent B - Vòng 4)", () => {
  const CRON_SECRET = "test-cron-secret-1234567890abcdef";
  const SESSION_SECRET = "test-session-secret-at-least-32-chars-long!";
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Giới hạn tần suất xác thực OTP lưu trong DB 5 phút; dọn để chạy lại liên tiếp không bị 429
    await createAdminSupabase().from("rate_limits").delete().like("key", "otp:ver:%");
    originalEnv = { ...process.env };
    process.env.DEMO_MODE = "true";
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.SESSION_SECRET = SESSION_SECRET;
    delete process.env.ALLOW_DEMO_STEP_UP_BYPASS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makeRequest(
    path: string,
    options: {
      authHeader?: string;
      cronHeader?: string;
      cookie?: string;
      role?: "LANDLORD" | "TENANT" | "ADMIN_DEMO";
      body?: Record<string, unknown>;
    } = {},
  ): Request {
    const headers = new Headers();
    headers.set("content-type", "application/json");

    if (options.authHeader) {
      headers.set("authorization", options.authHeader);
    }
    if (options.cronHeader) {
      headers.set("x-cron-secret", options.cronHeader);
    }

    if (options.role) {
      const userId =
        options.role === "LANDLORD"
          ? DEMO_USERS.LANDLORD.id
          : options.role === "TENANT"
            ? DEMO_USERS.TENANT_1.id
            : DEMO_USERS.ADMIN.id;
      const token = createSessionToken(userId, options.role);
      headers.set("cookie", `${DEMO_SESSION_COOKIE}=${token}`);
    } else if (options.cookie) {
      headers.set("cookie", options.cookie);
    }

    return new Request(`http://localhost:3000${path}`, {
      method: "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  // =========================================================================
  // 1. Kiểm tra 3 route demo: prepare, reset, seed
  // =========================================================================
  describe("1. Demo routes (/api/demo/{prepare,reset,seed}) access control", () => {
    const routes = [
      { name: "POST /api/demo/prepare", handler: demoPreparePost, path: "/api/demo/prepare" },
      { name: "POST /api/demo/reset", handler: demoResetPost, path: "/api/demo/reset" },
      { name: "POST /api/demo/seed", handler: demoSeedPost, path: "/api/demo/seed" },
    ];

    for (const { name, handler, path } of routes) {
      it(`${name}: từ chối khách vãng lai (không đăng nhập) với mã 403`, async () => {
        const req = makeRequest(path);
        const res = await handler(req, {});
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe("FORBIDDEN");
      });

      it(`${name}: từ chối người thuê (TENANT) với mã 403`, async () => {
        const req = makeRequest(path, { role: "TENANT" });
        const res = await handler(req, {});
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe("FORBIDDEN");
      });

      it(`${name}: từ chối chủ nhà (LANDLORD) với mã 403`, async () => {
        const req = makeRequest(path, { role: "LANDLORD" });
        const res = await handler(req, {});
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe("FORBIDDEN");
      });

      it(`${name}: từ chối khi gửi sai Bearer token`, async () => {
        const req = makeRequest(path, { authHeader: "Bearer wrong-secret" });
        const res = await handler(req, {});
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe("FORBIDDEN");
      });

      it(`${name}: cho phép tài khoản quản trị ADMIN_DEMO chạy (mã 200)`, async () => {
        const req = makeRequest(path, { role: "ADMIN_DEMO" });
        const res = await handler(req, {});
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.isDemo).toBe(true);
      });

      it(`${name}: cho phép gọi bằng Authorization: Bearer <CRON_SECRET> (mã 200)`, async () => {
        const req = makeRequest(path, { authHeader: `Bearer ${CRON_SECRET}` });
        const res = await handler(req, {});
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.isDemo).toBe(true);
      });

      it(`${name}: cho phép gọi bằng x-cron-secret (mã 200)`, async () => {
        const req = makeRequest(path, { cronHeader: CRON_SECRET });
        const res = await handler(req, {});
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.isDemo).toBe(true);
      });

      it(`${name}: trả về 404 khi DEMO_MODE !== 'true' (kể cả có quyền ADMIN_DEMO)`, async () => {
        process.env.DEMO_MODE = "false";
        const req = makeRequest(path, { role: "ADMIN_DEMO" });
        const res = await handler(req, {});
        expect(res.status).toBe(404);
      });
    }

    it("assertDemoRouteAccess ném lỗi NOT_FOUND khi DEMO_MODE !== 'true'", async () => {
      process.env.DEMO_MODE = "false";
      const req = makeRequest("/api/demo/prepare", { authHeader: `Bearer ${CRON_SECRET}` });
      await expect(assertDemoRouteAccess(req)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // =========================================================================
  // 2. Kiểm tra lối tắt demo-step-up và ALLOW_DEMO_STEP_UP_BYPASS
  // =========================================================================
  describe("2. Step-up token security & bypass protection", () => {
    const admin = createAdminSupabase();
    const userId = DEMO_USERS.LANDLORD.id;

    it("từ chối demo-step-up khi ALLOW_DEMO_STEP_UP_BYPASS không bật (mặc định)", async () => {
      delete process.env.ALLOW_DEMO_STEP_UP_BYPASS;

      const req = new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "x-step-up-token": "demo-step-up" },
      });

      await expect(requireStepUp(req, userId, "SIGN_CONTRACT")).rejects.toThrow();
    });

    it("từ chối demo-step-up khi ALLOW_DEMO_STEP_UP_BYPASS=false", async () => {
      process.env.ALLOW_DEMO_STEP_UP_BYPASS = "false";

      const req = new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "x-step-up-token": "demo-step-up" },
      });

      await expect(requireStepUp(req, userId, "SIGN_CONTRACT")).rejects.toThrow();
    });

    it("chấp nhận demo-step-up khi ALLOW_DEMO_STEP_UP_BYPASS=true trong DEMO_MODE", async () => {
      process.env.ALLOW_DEMO_STEP_UP_BYPASS = "true";

      const req = new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "x-step-up-token": "demo-step-up" },
      });

      await expect(requireStepUp(req, userId, "SIGN_CONTRACT")).resolves.toBeUndefined();
    });

    it("từ chối demo-step-up khi ALLOW_DEMO_STEP_UP_BYPASS=true nhưng DEMO_MODE=false", async () => {
      process.env.DEMO_MODE = "false";
      process.env.ALLOW_DEMO_STEP_UP_BYPASS = "true";

      const req = new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "x-step-up-token": "demo-step-up" },
      });

      await expect(requireStepUp(req, userId, "SIGN_CONTRACT")).rejects.toThrow();
    });

    it("token bước hai thật hoạt động bình thường và bị xóa (không dùng lại lần hai)", async () => {
      delete process.env.ALLOW_DEMO_STEP_UP_BYPASS;

      const { stepUpToken } = await createStepUpSession(admin, userId, "EXTEND_DUE");

      const req = new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "x-step-up-token": stepUpToken },
      });

      // Lần 1: Thành công
      await expect(requireStepUp(req, userId, "EXTEND_DUE")).resolves.toBeUndefined();

      // Lần 2 (replay attack): Bị từ chối vì token đã bị tiêu thụ
      await expect(requireStepUp(req, userId, "EXTEND_DUE")).rejects.toThrow();
    });
  });

  // =========================================================================
  // 3. Kiểm tra POST /api/jobs/overdue-scan
  // =========================================================================
  describe("3. Background job /api/jobs/overdue-scan access control", () => {
    it("từ chối khách vãng lai với mã 403", async () => {
      const req = makeRequest("/api/jobs/overdue-scan");
      const res = await overdueScanPost(req, {});
      expect(res.status).toBe(403);
    });

    it("từ chối người thuê (TENANT) với mã 403 khi DEMO_MODE=true", async () => {
      const req = makeRequest("/api/jobs/overdue-scan", { role: "TENANT" });
      const res = await overdueScanPost(req, {});
      expect(res.status).toBe(403);
    });

    it("từ chối chủ nhà (LANDLORD) với mã 403 khi DEMO_MODE=true", async () => {
      const req = makeRequest("/api/jobs/overdue-scan", { role: "LANDLORD" });
      const res = await overdueScanPost(req, {});
      expect(res.status).toBe(403);
    });

    it("cho phép tài khoản quản trị ADMIN_DEMO chạy (mã 200)", async () => {
      const req = makeRequest("/api/jobs/overdue-scan", { role: "ADMIN_DEMO" });
      const res = await overdueScanPost(req, {});
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.updatedCount).toBe(42);
    });

    it("cho phép gọi bằng Authorization: Bearer <CRON_SECRET> (mã 200)", async () => {
      const req = makeRequest("/api/jobs/overdue-scan", { authHeader: `Bearer ${CRON_SECRET}` });
      const res = await overdueScanPost(req, {});
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.updatedCount).toBe(42);
    });
  });

  // =========================================================================
  // 4. Kiểm tra tài khoản 0900000004 và vai trò ADMIN_DEMO
  // =========================================================================
  describe("4. Admin demo account 0900000004 & role enforcement", () => {
    it("0900000004 chỉ đăng nhập được bằng OTP bí mật DEMO_ADMIN_OTP và nhận vai trò ADMIN_DEMO", async () => {
      const previous = process.env.DEMO_ADMIN_OTP;
      process.env.DEMO_ADMIN_OTP = "test-admin-otp-8";
      try {
        const make = (code: string) =>
          new Request("http://localhost:3000/api/auth/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: "0900000004", code }),
          });

        // Mã demo công khai không còn mở được tài khoản quản trị
        expect((await otpVerifyPost(make("123456"), {})).status).toBe(400);

        const res = await otpVerifyPost(make("test-admin-otp-8"), {});
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.data.user.phone).toBe("0900000004");
        expect(json.data.user.role).toBe("ADMIN_DEMO");
      } finally {
        if (previous === undefined) delete process.env.DEMO_ADMIN_OTP;
        else process.env.DEMO_ADMIN_OTP = previous;
      }
    });

    it("client gửi role: ADMIN_DEMO với số điện thoại khác KHÔNG được nhận vai trò ADMIN_DEMO", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0900000001",
          code: "123456",
          role: "ADMIN_DEMO",
        }),
      });

      const res = await otpVerifyPost(req, {});
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.user.phone).toBe("0900000001");
      expect(json.data.user.role).not.toBe("ADMIN_DEMO");
      expect(["LANDLORD", "TENANT"]).toContain(json.data.user.role);
    });

    it("số điện thoại lạ không nhận được mã mô phỏng 123456 mà không có OTP trong DB", async () => {
      const req = new Request("http://localhost:3000/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "0987654321", code: "123456" }),
      });

      const res = await otpVerifyPost(req, {});
      expect(res.status).toBe(400); // VALIDATION_ERROR do không tìm thấy otp trong DB
    });
  });
});
