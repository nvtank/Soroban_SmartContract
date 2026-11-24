import "@/../tests/setup";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { GET as getContractOnchain } from "@/app/api/contracts/[id]/onchain/route";
import { POST as retryOnchain } from "@/app/api/onchain/[id]/retry/route";
import { POST as flushOnchainJob } from "@/app/api/jobs/flush-onchain/route";
import { GET as getPublicFeed } from "@/app/api/public/onchain-feed/route";
import { createTestAdminClient } from "./helpers";

describe("Stellar On-chain Route Handlers", () => {
  const admin = createTestAdminClient();
  let testLandlordId = "";
  let testContractId = "";
  const nonExistentContractId = "00000000-0000-0000-0000-000000000000";
  const dummyTxId = "tx-1234-5678";

  beforeAll(async () => {
    // Tạo landlord và hợp đồng thật trong DB để kiểm thử quyền truy cập
    const email = `landlord_routes_${Date.now()}@rentflow.local`;
    const res = await admin.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Stellar Landlord Routes" },
    });
    testLandlordId = res.data.user!.id;

    await admin.from("profiles").upsert({
      id: testLandlordId,
      phone: `09${Date.now().toString().slice(-8)}`,
      full_name: "Stellar Landlord Routes",
      role: "LANDLORD",
    });

    const cRes = await admin
      .from("rental_contracts")
      .insert({
        landlord_id: testLandlordId,
        room_label: "Phòng 101 Test Routes",
        rent_amount: 5000000,
        deposit_amount: 10000000,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        due_day: 5,
        late_fee_bps_per_day: 50,
        status: "ACTIVE",
      })
      .select("id")
      .single();

    testContractId = cRes.data!.id;
  });

  afterAll(async () => {
    if (testContractId) {
      await admin.from("onchain_txs").delete().eq("contract_id", testContractId);
      await admin.from("rental_contracts").delete().eq("id", testContractId);
    }
    if (testLandlordId) {
      await admin.from("profiles").delete().eq("id", testLandlordId);
      await admin.auth.admin.deleteUser(testLandlordId);
    }
  });

  describe("GET /api/contracts/[id]/onchain", () => {
    it("trả về 401 khi không có thông tin xác thực", async () => {
      const req = new Request(`http://localhost/api/contracts/${testContractId}/onchain`);
      const context = { params: Promise.resolve({ id: testContractId }) };

      const res = await getContractOnchain(req, context);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("trả về 404 khi hợp đồng không tồn tại", async () => {
      const req = new Request(`http://localhost/api/contracts/${nonExistentContractId}/onchain`, {
        headers: {
          "x-test-user-id": testLandlordId,
          "x-test-user-role": "LANDLORD",
        },
      });
      const context = { params: Promise.resolve({ id: nonExistentContractId }) };

      const res = await getContractOnchain(req, context);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("trả về 403 khi người dùng không phải là bên tham gia hợp đồng", async () => {
      const req = new Request(`http://localhost/api/contracts/${testContractId}/onchain`, {
        headers: {
          "x-test-user-id": "stranger-user-id",
          "x-test-user-role": "TENANT",
        },
      });
      const context = { params: Promise.resolve({ id: testContractId }) };

      const res = await getContractOnchain(req, context);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("trả về 200 và danh sách giao dịch khi đã xác thực là chủ nhà hợp lệ", async () => {
      const req = new Request(`http://localhost/api/contracts/${testContractId}/onchain`, {
        headers: {
          "x-test-user-id": testLandlordId,
          "x-test-user-role": "LANDLORD",
        },
      });
      const context = { params: Promise.resolve({ id: testContractId }) };

      const res = await getContractOnchain(req, context);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("trả về 200 khi người gọi là ADMIN_DEMO", async () => {
      const req = new Request(`http://localhost/api/contracts/${testContractId}/onchain`, {
        headers: {
          "x-test-user-id": "admin-demo-id",
          "x-test-user-role": "ADMIN_DEMO",
        },
      });
      const context = { params: Promise.resolve({ id: testContractId }) };

      const res = await getContractOnchain(req, context);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("POST /api/onchain/[id]/retry", () => {
    it("trả về 401 khi không có thông tin xác thực", async () => {
      const req = new Request(`http://localhost/api/onchain/${dummyTxId}/retry`, {
        method: "POST",
      });
      const context = { params: Promise.resolve({ id: dummyTxId }) };

      const res = await retryOnchain(req, context);
      expect(res.status).toBe(401);
    });

    it("trả về 404 khi không tìm thấy giao dịch", async () => {
      const req = new Request(`http://localhost/api/onchain/${dummyTxId}/retry`, {
        method: "POST",
        headers: {
          "x-test-user-id": "user-1",
          "x-test-user-role": "LANDLORD",
        },
      });
      const context = { params: Promise.resolve({ id: dummyTxId }) };

      const res = await retryOnchain(req, context);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/jobs/flush-onchain", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "super-secret-cron-key";
    });

    const dummyContext = {} as unknown as { params: Promise<Record<string, string>> };

    it("trả về 403 khi gọi job mà không có CRON_SECRET hợp lệ", async () => {
      const req = new Request("http://localhost/api/jobs/flush-onchain", {
        method: "POST",
      });

      const res = await flushOnchainJob(req, dummyContext);
      expect(res.status).toBe(403);
    });

    it("trả về 200 khi có Bearer token khớp CRON_SECRET", async () => {
      const req = new Request("http://localhost/api/jobs/flush-onchain", {
        method: "POST",
        headers: {
          authorization: "Bearer super-secret-cron-key",
        },
      });

      const res = await flushOnchainJob(req, dummyContext);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveProperty("confirmed");
      expect(json.data).toHaveProperty("failed");
    });

    it("trả về 200 khi người gọi có vai trò ADMIN_DEMO", async () => {
      const req = new Request("http://localhost/api/jobs/flush-onchain", {
        method: "POST",
        headers: {
          "x-test-user-role": "ADMIN_DEMO",
        },
      });

      const res = await flushOnchainJob(req, dummyContext);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/public/onchain-feed", () => {
    const feedContext = {} as unknown as { params: Promise<Record<string, string>> };

    it("trả về 200 cho người dùng công khai mà không cần xác thực", async () => {
      const req = new Request("http://localhost/api/public/onchain-feed?limit=5");
      const res = await getPublicFeed(req, feedContext);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(res.headers.get("cache-control")).toContain("public");
    });
  });
});
