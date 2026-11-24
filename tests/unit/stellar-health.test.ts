import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { checkStellarHealth } from "@/lib/stellar/health";
import { MockStellarRpcClient } from "../helpers/mock-rpc";

describe("checkStellarHealth - Kiểm tra sức khỏe chuỗi", () => {
  const dummyContractId = "CCDNF4D4HRIDYSHBEOV2IYC2XQSTD7VPSFZ4NSGCT2QVDPJ7RX4UBVXU";
  const platformKp = Keypair.random();
  const oracleKp = Keypair.random();

  it("trả về ok: true khi RPC sống, contract trả ContractNotFound, và số dư PLATFORM + ORACLE đủ lớn", async () => {
    const mockRpc = new MockStellarRpcClient(dummyContractId);
    mockRpc.setAccountBalance(platformKp.publicKey(), 100);
    mockRpc.setAccountBalance(oracleKp.publicKey(), 50);
    // Giả lập hợp đồng trả về đúng ContractNotFound khi đọc ID không tồn tại
    mockRpc.setSimulateContractError("HostError: Error(Contract, #5)");

    const health = await checkStellarHealth({
      contractId: dummyContractId,
      platformPublicKey: platformKp.publicKey(),
      oraclePublicKey: oracleKp.publicKey(),
      rpcClient: mockRpc,
      minThresholdXlm: 10,
    });

    expect(health.ok).toBe(true);
    expect(health.rpc.ok).toBe(true);
    expect(health.rpc.latestLedger).toBe(1000);
    expect(health.contract.ok).toBe(true);
    expect(health.contract.verified).toBe(true);
    expect(health.balances.ok).toBe(true);
    expect(health.balances.platform.balanceXlm).toBe(100);
    expect(health.balances.platform.isLow).toBe(false);
    expect(health.balances.oracle.balanceXlm).toBe(50);
    expect(health.balances.oracle.isLow).toBe(false);
  });

  it("báo lỗi RPC khi RPC không thể kết nối hoặc lỗi mạng", async () => {
    const mockRpc = new MockStellarRpcClient(dummyContractId);
    // Giả lập lỗi RPC bằng URL không hợp lệ và không dùng mock getLatestLedgerSequence
    const failingMock = {
      ...mockRpc,
      getLatestLedgerSequence: async () => {
        throw new Error("RPC connection refused");
      },
    };

    const health = await checkStellarHealth({
      contractId: dummyContractId,
      platformPublicKey: platformKp.publicKey(),
      oraclePublicKey: oracleKp.publicKey(),
      rpcClient: failingMock as unknown as MockStellarRpcClient,
    });

    expect(health.ok).toBe(false);
    expect(health.rpc.ok).toBe(false);
    expect(health.rpc.error).toMatch(/RPC connection refused/);
  });

  it("báo lỗi contract khi thiếu cấu hình contractId", async () => {
    const mockRpc = new MockStellarRpcClient("");

    const health = await checkStellarHealth({
      contractId: "",
      platformPublicKey: platformKp.publicKey(),
      oraclePublicKey: oracleKp.publicKey(),
      rpcClient: mockRpc,
    });

    expect(health.ok).toBe(false);
    expect(health.contract.ok).toBe(false);
    expect(health.contract.verified).toBe(false);
    expect(health.contract.error).toMatch(/Chưa cấu hình STELLAR_CONTRACT_ID/);
  });

  it("báo lỗi contract khi mô phỏng get_contract không trả về lỗi ContractNotFound (lỗi mạng hoặc contract không tồn tại)", async () => {
    const mockRpc = new MockStellarRpcClient(dummyContractId);
    // Giả lập lỗi khác (ví dụ: contract không tồn tại hoặc lỗi mạng)
    mockRpc.setSimulateContractError("HostError: Error(Value, InvalidInput)");

    const health = await checkStellarHealth({
      contractId: dummyContractId,
      platformPublicKey: platformKp.publicKey(),
      oraclePublicKey: oracleKp.publicKey(),
      rpcClient: mockRpc,
    });

    expect(health.ok).toBe(false);
    expect(health.contract.ok).toBe(false);
    expect(health.contract.verified).toBe(false);
  });

  it("phát hiện số dư thấp dưới ngưỡng của PLATFORM hoặc ORACLE", async () => {
    const mockRpc = new MockStellarRpcClient(dummyContractId);
    mockRpc.setAccountBalance(platformKp.publicKey(), 2.5); // < 10 XLM
    mockRpc.setAccountBalance(oracleKp.publicKey(), 100);
    mockRpc.setSimulateContractError("HostError: Error(Contract, #5)");

    const health = await checkStellarHealth({
      contractId: dummyContractId,
      platformPublicKey: platformKp.publicKey(),
      oraclePublicKey: oracleKp.publicKey(),
      rpcClient: mockRpc,
      minThresholdXlm: 10,
    });

    expect(health.ok).toBe(false);
    expect(health.balances.ok).toBe(false);
    expect(health.balances.platform.balanceXlm).toBe(2.5);
    expect(health.balances.platform.isLow).toBe(true);
    expect(health.balances.oracle.isLow).toBe(false);
  });

  it("tuyệt đối không in hoặc để lộ secret key trong báo cáo sức khỏe", async () => {
    const mockRpc = new MockStellarRpcClient(dummyContractId);
    mockRpc.setAccountBalance(platformKp.publicKey(), 50);
    mockRpc.setAccountBalance(oracleKp.publicKey(), 50);
    mockRpc.setSimulateContractError("HostError: Error(Contract, #5)");

    const health = await checkStellarHealth({
      contractId: dummyContractId,
      platformSecret: platformKp.secret(), // truyền secret key
      oracleSecret: oracleKp.secret(),     // truyền secret key
      rpcClient: mockRpc,
    });

    const reportJson = JSON.stringify(health);
    expect(reportJson).not.toContain(platformKp.secret());
    expect(reportJson).not.toContain(oracleKp.secret());
    expect(health.balances.platform.publicKey).toBe(platformKp.publicKey());
    expect(health.balances.oracle.publicKey).toBe(oracleKp.publicKey());
  });
});
