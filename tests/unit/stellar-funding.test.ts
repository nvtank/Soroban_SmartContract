import { describe, it, expect, beforeEach } from "vitest";
import { Keypair, Networks } from "@stellar/stellar-sdk";
import { enqueueOnchain, flushOnchain, retryOnchainTx } from "@/lib/stellar/outbox";
import { MockStellarRpcClient } from "../helpers/mock-rpc";
import type { OnchainTxRecord, OutboxDeps } from "@/lib/stellar/types";

describe("Stellar User Account & Friendbot Funding on Testnet", () => {
  let mockDb: { onchain_txs: OnchainTxRecord[] };
  let mockClient: MockStellarRpcClient;
  const platformKey = Keypair.random();
  const oracleKey = Keypair.random();
  const userKey = Keypair.random();

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
      return fn(userKey);
    },
  });

  it("tài khoản người dùng đã tồn tại trên mạng thì ký bình thường không cần nạp", async () => {
    mockClient.setAccountExists(userKey.publicKey(), true);

    await enqueueOnchain(mockDb, {
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

    const res = await flushOnchain(mockDb, { limit: 1 }, getDeps());
    expect(res.confirmed).toBe(1);
    expect(res.failed).toBe(0);
    expect(mockDb.onchain_txs[0].status).toBe("CONFIRMED");
    expect(mockDb.onchain_txs[0].error).toBeNull();
  });

  it("tài khoản chưa tồn tại trên Testnet thì tự động nạp qua Friendbot và tiếp tục ký", async () => {
    // Tài khoản ban đầu chưa có trên ledger
    mockClient.setAccountExists(userKey.publicKey(), false);
    mockClient.setFriendbotSuccess(true);

    await enqueueOnchain(mockDb, {
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

    const res = await flushOnchain(mockDb, { limit: 1 }, getDeps());
    expect(res.confirmed).toBe(1);
    expect(mockDb.onchain_txs[0].status).toBe("CONFIRMED");
    // Sau khi nạp thành công, tài khoản đã tồn tại
    expect(await mockClient.accountExists(userKey.publicKey())).toBe(true);
  });

  it("không bao giờ gọi Friendbot khi mạng không phải là Testnet", async () => {
    // Đổi mạng sang Public Network
    mockClient.setNetworkPassphrase(Networks.PUBLIC);
    mockClient.setAccountExists(userKey.publicKey(), false);

    await enqueueOnchain(mockDb, {
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

    const res = await flushOnchain(mockDb, { limit: 1 }, getDeps());
    expect(res.confirmed).toBe(0);
    expect(res.failed).toBe(1);
    const tx = mockDb.onchain_txs[0];
    expect(tx.status).toBe("FAILED");
    expect(tx.error).toMatch(/Ví người dùng chưa tồn tại trên mạng blockchain/);
    expect(tx.tx_hash).toBeNull();
  });

  it("lỗi Friendbot nạp tiền thất bại phải ra thông báo tiếng Việt rõ ràng và để giao dịch ở trạng thái thử lại được", async () => {
    mockClient.setAccountExists(userKey.publicKey(), false);
    // Giả lập Friendbot lỗi hoặc bị rate limit
    mockClient.setFriendbotSuccess(false);

    await enqueueOnchain(mockDb, {
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

    const res = await flushOnchain(mockDb, { limit: 1 }, getDeps());
    expect(res.confirmed).toBe(0);
    expect(res.failed).toBe(1);

    const tx = mockDb.onchain_txs[0];
    expect(tx.status).toBe("FAILED");
    expect(tx.tx_hash).toBeNull();
    expect(tx.error).toMatch(/Friendbot không phản hồi hoặc bị giới hạn tần suất/);
    expect(tx.locked_at).toBeNull();
    expect(tx.locked_by).toBeNull();

    // Kiểm tra giao dịch có thể thử lại được bằng retryOnchainTx
    mockClient.setFriendbotSuccess(true);
    const retried = await retryOnchainTx(mockDb, tx.id, getDeps());
    expect(retried.status).toBe("CONFIRMED");
    expect(mockDb.onchain_txs[0].status).toBe("CONFIRMED");
  });
});
