import { describe, it, expect, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { enqueueOnchain, flushOnchain, retryOnchainTx, getContractOnchainTxs } from "@/lib/stellar/outbox";
import { getStellarClient } from "@/lib/stellar/client";
import { MockStellarRpcClient } from "../helpers/mock-rpc";
import { ApiError } from "@/lib/api/http";
import type { OnchainTxRecord, OutboxDeps } from "@/lib/stellar/types";

describe("Stellar Outbox & Queue Manager", () => {
  let mockDb: { onchain_txs: OnchainTxRecord[] };
  let mockClient: MockStellarRpcClient;
  const platformKey = Keypair.random();
  const oracleKey = Keypair.random();

  const dummyUUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const dummyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const dummyAddrLandlord = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const dummyAddrTenant = "GAH4YJWAPLQUY6KXV6CBFEQLK7GN4VKBQ6RMKY26UTEPDTNV7EIZDOFK";

  beforeEach(() => {
    mockDb = { onchain_txs: [] };
    mockClient = new MockStellarRpcClient();
  });

  const getDeps = (): Partial<OutboxDeps> => ({
    stellarClient: mockClient,
    getPlatformKeypair: () => platformKey,
    getOracleKeypair: () => oracleKey,
    withCustodyKeypair: async <T>(
      _db: unknown,
      _userId: string,
      fn: (kp: Keypair) => Promise<T>,
    ): Promise<T> => {
      return fn(Keypair.random());
    },
  });

  describe("enqueueOnchain", () => {
    it("đưa giao dịch hợp lệ vào hàng đợi với trạng thái PENDING", async () => {
      const res = await enqueueOnchain(mockDb, {
        contractId: dummyUUID,
        action: "create_contract",
        args: {
          id: dummyUUID,
          landlord: dummyAddrLandlord,
          tenant: dummyAddrTenant,
          doc_hash: dummyHash,
          deposit: "10000000",
          rent: "5000000",
          due_day: 5,
          late_fee_bps_per_day: 50,
        },
        signer: { kind: "USER", userId: "user-123" },
      });

      expect(res.id).toBeDefined();
      expect(mockDb.onchain_txs).toHaveLength(1);
      const inserted = mockDb.onchain_txs[0];
      expect(inserted.status).toBe("PENDING");
      expect(inserted.contract_id).toBe(dummyUUID);
      expect(inserted.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("chặn payload chứa PII không cho enqueue", async () => {
      await expect(
        enqueueOnchain(mockDb, {
          contractId: dummyUUID,
          action: "create_contract",
          args: {
            id: dummyUUID,
            phone: "0901234567", // PII vi phạm
          },
          signer: { kind: "USER", userId: "user-123" },
        }),
      ).rejects.toThrow(ApiError);

      expect(mockDb.onchain_txs).toHaveLength(0);
    });

    it("chặn tên action không có trong ABI", async () => {
      await expect(
        enqueueOnchain(mockDb, {
          contractId: dummyUUID,
          action: "invalid_action_name",
          args: {},
          signer: { kind: "USER", userId: "user-123" },
        }),
      ).rejects.toThrow(ApiError);
    });
  });

  describe("flushOnchain", () => {
    it("xử lý giao dịch PENDING thành công chuyển sang CONFIRMED và có tx_hash", async () => {
      await enqueueOnchain(mockDb, {
        contractId: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "user-tenant" },
      });

      const res = await flushOnchain(mockDb, {}, getDeps());
      expect(res.confirmed).toBe(1);
      expect(res.failed).toBe(0);

      const record = mockDb.onchain_txs[0];
      expect(record.status).toBe("CONFIRMED");
      expect(record.tx_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(record.error).toBeNull();
    });

    it("giữ thứ tự FIFO theo từng hợp đồng: nếu giao dịch trước FAILED thì chặn giao dịch sau", async () => {
      // Giao dịch 1 bị FAILED
      mockDb.onchain_txs.push({
        id: "tx-1",
        contract_id: dummyUUID,
        action: "create_contract",
        args: [],
        signer: { kind: "USER", userId: "u1" },
        payload_hash: "hash1",
        status: "FAILED",
        tx_hash: null,
        error: "Lỗi trước đó",
        retry_count: 1,
        created_at: "2026-11-23T10:00:00Z",
      });

      // Giao dịch 2 PENDING sau đó
      mockDb.onchain_txs.push({
        id: "tx-2",
        contract_id: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "u2" },
        payload_hash: "hash2",
        status: "PENDING",
        tx_hash: null,
        error: null,
        retry_count: 0,
        created_at: "2026-11-23T10:05:00Z",
      });

      const res = await flushOnchain(mockDb, {}, getDeps());
      expect(res.confirmed).toBe(0);
      expect(res.failed).toBe(0);

      // tx-2 vẫn phải ở PENDING, không được tự động chạy vượt mặt
      expect(mockDb.onchain_txs[1].status).toBe("PENDING");
    });

    it("đối soát giao dịch đã SUBMITTED, không submit lại mù", async () => {
      const existingHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      mockDb.onchain_txs.push({
        id: "tx-sub",
        contract_id: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "u2" },
        payload_hash: "hash-sub",
        status: "SUBMITTED",
        tx_hash: existingHash,
        error: null,
        retry_count: 1,
        created_at: "2026-11-23T10:00:00Z",
      });

      const res = await flushOnchain(mockDb, {}, getDeps());
      expect(res.confirmed).toBe(1);

      // tx-sub được đối soát và chuyển thành CONFIRMED với hash cũ, không sinh hash mới
      expect(mockDb.onchain_txs[0].status).toBe("CONFIRMED");
      expect(mockDb.onchain_txs[0].tx_hash).toBe(existingHash);
    });

    it("chuyển sang FAILED khi vượt quá số lần thử lại tối đa (5)", async () => {
      mockDb.onchain_txs.push({
        id: "tx-max-retry",
        contract_id: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "u2" },
        payload_hash: "hash-max",
        status: "PENDING",
        tx_hash: null,
        error: null,
        retry_count: 5, // Đã chạm mốc 5
        created_at: "2026-11-23T10:00:00Z",
      });

      const res = await flushOnchain(mockDb, {}, getDeps());
      expect(res.failed).toBe(1);
      expect(mockDb.onchain_txs[0].status).toBe("FAILED");
      expect(mockDb.onchain_txs[0].error).toContain("tối đa");
    });

    it("làm sạch lỗi và không lưu trữ secret key khi RPC thất bại", async () => {
      mockDb.onchain_txs.push({
        id: "tx-err",
        contract_id: dummyUUID,
        action: "record_deposit_paid",
        args: {
          id: dummyUUID,
          payment_ref_hash: dummyHash,
          amount: "10000000",
        },
        signer: { kind: "ORACLE" },
        payload_hash: "hash-err",
        status: "PENDING",
        tx_hash: null,
        error: null,
        retry_count: 0,
        created_at: "2026-11-23T10:00:00Z",
      });

      // Tạo client giả lập ném lỗi chứa secret
      const failingClient = new MockStellarRpcClient();
      failingClient.submitTransaction = async () => ({
        txHash: "",
        status: "FAILED",
        error: "Fail with secret SCQXYZAAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKKLLLMMMNNNOOOPPPQQQ",
      });

      await flushOnchain(mockDb, {}, { ...getDeps(), stellarClient: failingClient });

      const tx = mockDb.onchain_txs[0];
      expect(tx.status).toBe("FAILED");
      expect(tx.error).not.toContain("SCQXYZAAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKKLLLMMMNNNOOOPPPQQQ");
      expect(tx.error).toContain("[REDACTED_SECRET]");
    });

    it("khi thiếu STELLAR_CONTRACT_ID thì flushOnchain đánh dấu FAILED, tx_hash là null, không bao giờ sang CONFIRMED", async () => {
      const unconfiguredClient = getStellarClient({ contractId: "" });
      await enqueueOnchain(mockDb, {
        contractId: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "user-tenant" },
      });

      const res = await flushOnchain(mockDb, {}, { ...getDeps(), stellarClient: unconfiguredClient });
      expect(res.confirmed).toBe(0);
      expect(res.failed).toBe(1);

      const tx = mockDb.onchain_txs[0];
      expect(tx.status).toBe("FAILED");
      expect(tx.tx_hash).toBeNull();
      expect(tx.error).toContain("STELLAR_CONTRACT_ID");

      // Thử lại giao dịch thành công (chuyển PENDING hoặc FAILED nếu flush nhanh chạy, không có tx_hash)
      const retried = await retryOnchainTx(mockDb, tx.id, {
        ...getDeps(),
        stellarClient: unconfiguredClient,
      });
      expect(["PENDING", "FAILED"]).toContain(retried.status);
      expect(retried.txHash).toBeNull();
    });
  });

  describe("retryOnchainTx", () => {
    it("cho phép thử lại giao dịch FAILED chuyển về PENDING", async () => {
      mockDb.onchain_txs.push({
        id: "tx-failed-1",
        contract_id: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "u1" },
        payload_hash: "hash-f",
        status: "FAILED",
        tx_hash: null,
        error: "Lỗi mạng",
        retry_count: 2,
        created_at: "2026-11-23T10:00:00Z",
      });

      const updated = await retryOnchainTx(mockDb, "tx-failed-1", getDeps());
      // retryOnchainTx chuyển PENDING rồi flush có thể CONFIRMED ngay
      expect(["PENDING", "CONFIRMED"]).toContain(updated.status);
    });

    it("chặn thử lại giao dịch không ở trạng thái FAILED", async () => {
      mockDb.onchain_txs.push({
        id: "tx-conf-1",
        contract_id: dummyUUID,
        action: "tenant_confirm",
        args: { id: dummyUUID, tenant: dummyAddrTenant },
        signer: { kind: "USER", userId: "u1" },
        payload_hash: "hash-c",
        status: "CONFIRMED",
        tx_hash: "txhash123",
        error: null,
        retry_count: 1,
        created_at: "2026-11-23T10:00:00Z",
      });

      await expect(retryOnchainTx(mockDb, "tx-conf-1", getDeps())).rejects.toThrow(ApiError);
    });
  });

  describe("getContractOnchainTxs", () => {
    it("trả về danh sách OnchainTxDto đã khử PII và có explorerUrl", async () => {
      mockDb.onchain_txs.push({
        id: "tx-1",
        contract_id: dummyUUID,
        action: "create_contract",
        args: { id: dummyUUID },
        signer: { kind: "USER", userId: "u1" },
        payload_hash: "p1",
        status: "CONFIRMED",
        tx_hash: "abc12345",
        error: null,
        retry_count: 0,
        created_at: "2026-11-23T10:00:00Z",
      });

      const list = await getContractOnchainTxs(mockDb, dummyUUID);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("tx-1");
      expect(list[0].status).toBe("CONFIRMED");
      expect(list[0].explorerUrl).toContain("abc12345");
      const first = list[0] as unknown as Record<string, unknown>;
      expect(first.args).toBeUndefined(); // Không lộ args nội bộ
      expect(first.signer).toBeUndefined();
    });
  });
});
