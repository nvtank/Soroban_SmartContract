import { describe, it, expect } from "vitest";
import { Keypair, TransactionBuilder, Networks, Account } from "@stellar/stellar-sdk";
import { buildFeeBumpTx, isFeeBumpEnabled } from "@/lib/stellar/fee-bump";

describe("Stellar Fee-Bump (CAP-0015, P1)", () => {
  it("xây dựng thành công FeeBumpTransaction với tài khoản nguồn PLATFORM", () => {
    const platformKey = Keypair.random();
    const userKey = Keypair.random();

    const userAccount = new Account(userKey.publicKey(), "50");
    const innerTx = new TransactionBuilder(userAccount, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .setTimeout(30)
      .build();

    innerTx.sign(userKey);

    const feeBump = buildFeeBumpTx(innerTx, platformKey, Networks.TESTNET, "300");

    expect(feeBump).toBeDefined();
    expect(feeBump.feeSource).toBe(platformKey.publicKey());
    expect(feeBump.fee).toBe("300");
    expect(feeBump.innerTransaction.toXDR()).toBe(innerTx.toXDR());
  });

  it("isFeeBumpEnabled trả về false theo mặc định nếu biến môi trường chưa bật", () => {
    delete process.env.STELLAR_ENABLE_FEE_BUMP;
    expect(isFeeBumpEnabled()).toBe(false);

    process.env.STELLAR_ENABLE_FEE_BUMP = "true";
    expect(isFeeBumpEnabled()).toBe(true);
    delete process.env.STELLAR_ENABLE_FEE_BUMP;
  });
});
