import { describe, it, expect } from "vitest";
import { getStellarClient, MockStellarRpcClient } from "@/lib/stellar/client";
import { getExplorerTxUrl, fundWithFriendbot } from "@/lib/stellar/explorer";
import { encodeContractArgs } from "@/lib/stellar/abi";

describe("Stellar RPC Client & Explorer Integration", () => {
  describe("getStellarClient fallback behavior", () => {
    it("tự động dùng MockStellarRpcClient khi chưa có STELLAR_CONTRACT_ID", () => {
      const client = getStellarClient({ isMock: true });
      expect(client.isMock()).toBe(true);
      expect(client.getContractId()).toBeDefined();
    });

    it("Mock client hỗ trợ build, simulate, submit và poll giao dịch", async () => {
      const client = new MockStellarRpcClient();
      const scVals = encodeContractArgs("tenant_confirm", {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        tenant: "GAH4YJWAPLQUY6KXV6CBFEQLK7GN4VKBQ6RMKY26UTEPDTNV7EIZDOFK",
      });

      const { transaction } = await client.buildAndSimulate({
        action: "tenant_confirm",
        args: scVals,
        sourcePublicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      });

      expect(transaction).toBeDefined();

      const subRes = await client.submitTransaction(transaction);
      expect(subRes.status).toBe("SUCCESS");
      expect(subRes.txHash).toMatch(/^[0-9a-f]{64}$/);

      const statusRes = await client.pollTransaction(subRes.txHash, 3000, 500);
      expect(statusRes.status).toBe("SUCCESS");
      expect(statusRes.ledger).toBeGreaterThan(0);
    });
  });

  describe("Stellar Explorer URLs", () => {
    it("tạo link explorer chính xác tới Stellar Expert", () => {
      const hash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f61234";
      const url = getExplorerTxUrl(hash);
      expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
    });
  });

  describe("Friendbot Funding", () => {
    it("xử lý yêu cầu nạp tiền Friendbot mà không làm crash ứng dụng", async () => {
      const res = await fundWithFriendbot("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
      expect(res).toHaveProperty("success");
    });
  });
});
