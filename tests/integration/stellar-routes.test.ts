import { describe, it, expect, beforeEach } from "vitest";
import { GET as getContractOnchain } from "@/app/api/contracts/[id]/onchain/route";
import { POST as retryOnchain } from "@/app/api/onchain/[id]/retry/route";
import { POST as flushOnchainJob } from "@/app/api/jobs/flush-onchain/route";

describe("Stellar On-chain Route Handlers", () => {
  const dummyContractId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const dummyTxId = "tx-1234-5678";

  describe("GET /api/contracts/[id]/onchain", () => {
    it("trả về 401 khi không có thông tin xác thực", async () => {
      const req = new Request(`http://localhost/api/contracts/${dummyContractId}/onchain`);
      const context = { params: Promise.resolve({ id: dummyContractId }) };

      const res = await getContractOnchain(req, context);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("UNAUTHENTICATED");
    });

    it("trả về 200 và danh sách rỗng khi đã xác thực hợp lệ", async () => {
      const req = new Request(`http://localhost/api/contracts/${dummyContractId}/onchain`, {
        headers: {
          "x-test-user-id": "user-landlord-1",
          "x-test-user-role": "LANDLORD",
        },
      });
      const context = { params: Promise.resolve({ id: dummyContractId }) };

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
    const originalCronSecret = process.env.CRON_SECRET;

    beforeEach(() => {
      process.env.CRON_SECRET = "super-secret-cron-key";
    });

    it("trả về 403 khi gọi job mà không có CRON_SECRET hợp lệ", async () => {
      const req = new Request("http://localhost/api/jobs/flush-onchain", {
        method: "POST",
      });

      const res = await flushOnchainJob(req, {} as any);
      expect(res.status).toBe(403);
    });

    it("trả về 200 khi có Bearer token khớp CRON_SECRET", async () => {
      const req = new Request("http://localhost/api/jobs/flush-onchain", {
        method: "POST",
        headers: {
          authorization: "Bearer super-secret-cron-key",
        },
      });

      const res = await flushOnchainJob(req, {} as any);
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

      const res = await flushOnchainJob(req, {} as any);
      expect(res.status).toBe(200);
    });
  });
});
