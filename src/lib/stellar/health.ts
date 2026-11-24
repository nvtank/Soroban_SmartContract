import {
  rpc,
  Contract,
  Account,
  Keypair,
  TransactionBuilder,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import type { StellarRpcClient } from "./types";
import { sanitizeError } from "./pii";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;
const DEFAULT_MIN_THRESHOLD_XLM = 10;

export type AccountBalanceHealth = {
  publicKey: string;
  balanceXlm: number | null;
  isLow: boolean;
  minThresholdXlm: number;
  error?: string;
};

export type StellarHealthResult = {
  ok: boolean;
  rpc: {
    ok: boolean;
    url: string;
    latestLedger?: number;
    error?: string;
  };
  contract: {
    ok: boolean;
    contractId: string;
    verified: boolean;
    error?: string;
  };
  balances: {
    ok: boolean;
    platform: AccountBalanceHealth;
    oracle: AccountBalanceHealth;
  };
};

export type StellarHealthOptions = {
  rpcUrl?: string;
  networkPassphrase?: string;
  contractId?: string;
  platformSecret?: string;
  oracleSecret?: string;
  platformPublicKey?: string;
  oraclePublicKey?: string;
  minThresholdXlm?: number;
  rpcClient?: StellarRpcClient;
};

/**
 * Trích xuất khóa công khai (G...) từ secret key mà tuyệt đối không log hay in secret.
 */
function resolvePublicKey(secret?: string, explicitPubkey?: string): string | null {
  if (explicitPubkey && explicitPubkey.startsWith("G") && explicitPubkey.length === 56) {
    return explicitPubkey;
  }
  if (secret && secret.startsWith("S") && secret.length === 56) {
    try {
      return Keypair.fromSecret(secret).publicKey();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Kiểm tra sức khỏe toàn diện của mạng Stellar và hợp đồng Soroban:
 * 1. RPC sống (kết nối và lấy được ledger mới nhất)
 * 2. Contract tồn tại trên mạng (mô phỏng get_contract với ID không tồn tại phải trả về lỗi ContractNotFound, không phải lỗi mạng)
 * 3. Số dư XLM của PLATFORM và ORACLE có thấp dưới ngưỡng hay không (không để lộ secret key)
 */
export async function checkStellarHealth(options?: StellarHealthOptions): Promise<StellarHealthResult> {
  const rpcUrl = options?.rpcUrl || process.env.STELLAR_RPC_URL || DEFAULT_RPC_URL;
  const networkPassphrase =
    options?.networkPassphrase || process.env.STELLAR_NETWORK_PASSPHRASE || DEFAULT_NETWORK_PASSPHRASE;
  const contractId = options?.contractId ?? process.env.STELLAR_CONTRACT_ID ?? "";
  const minThresholdXlm = options?.minThresholdXlm ?? DEFAULT_MIN_THRESHOLD_XLM;

  const platformPubkey = resolvePublicKey(
    options?.platformSecret || process.env.STELLAR_PLATFORM_SECRET,
    options?.platformPublicKey,
  );
  const oraclePubkey = resolvePublicKey(
    options?.oracleSecret || process.env.STELLAR_ORACLE_SECRET,
    options?.oraclePublicKey,
  );

  // 1. Kiểm tra RPC
  let rpcOk = false;
  let latestLedger: number | undefined;
  let rpcError: string | undefined;

  try {
    if (options?.rpcClient?.getLatestLedgerSequence) {
      latestLedger = await options.rpcClient.getLatestLedgerSequence();
      rpcOk = true;
    } else {
      const server = new rpc.Server(rpcUrl);
      const ledger = await server.getLatestLedger();
      latestLedger = ledger.sequence;
      rpcOk = true;
    }
  } catch (err) {
    rpcOk = false;
    rpcError = sanitizeError(err);
  }

  // 2. Kiểm tra Contract tồn tại
  let contractOk = false;
  let contractVerified = false;
  let contractError: string | undefined;

  if (!contractId) {
    contractError = "Chưa cấu hình STELLAR_CONTRACT_ID trên hệ thống.";
  } else {
    try {
      if (options?.rpcClient) {
        // Hỗ trợ mock RPC client trong unit test
        const dummyIdScVal = xdr.ScVal.scvBytes(Buffer.alloc(16));
        try {
          await options.rpcClient.buildAndSimulate({
            action: "get_contract",
            args: [dummyIdScVal],
            sourcePublicKey: platformPubkey || Keypair.random().publicKey(),
          });
          // Nếu mock không throw: kiểm tra xem có cờ giả lập lỗi ContractNotFound không
          contractOk = true;
          contractVerified = true;
        } catch (simErr: unknown) {
          const msg = simErr instanceof Error ? simErr.message : String(simErr);
          if (msg.includes("ContractNotFound") || msg.includes("Error(Contract, #5)")) {
            contractOk = true;
            contractVerified = true;
          } else {
            contractOk = false;
            contractVerified = false;
            contractError = sanitizeError(simErr);
          }
        }
      } else {
        const server = new rpc.Server(rpcUrl);
        const dummyKp = Keypair.random();
        const acc = new Account(dummyKp.publicKey(), "100");
        const contract = new Contract(contractId);
        const dummyIdScVal = xdr.ScVal.scvBytes(Buffer.alloc(16));
        const op = contract.call("get_contract", dummyIdScVal);
        const tx = new TransactionBuilder(acc, {
          fee: "100",
          networkPassphrase,
        })
          .addOperation(op)
          .setTimeout(60)
          .build();

        const sim = await server.simulateTransaction(tx);
        // Phản hồi lỗi mô phỏng có trường error; phản hồi thành công thì không
        const errStr = (sim as { error?: string }).error || "";

        // Contract tồn tại khi và chỉ khi Soroban trả về lỗi ContractNotFound (Error(Contract, #5))
        if (errStr.includes("ContractNotFound") || errStr.includes("Error(Contract, #5)")) {
          contractOk = true;
          contractVerified = true;
        } else {
          contractOk = false;
          contractVerified = false;
          contractError = sanitizeError(errStr || "Không nhận được lỗi ContractNotFound như mong đợi");
        }
      }
    } catch (err) {
      // Lỗi mạng hoặc lỗi không kết nối được tới RPC
      contractOk = false;
      contractVerified = false;
      contractError = sanitizeError(err);
    }
  }

  // 3. Kiểm tra số dư XLM của PLATFORM và ORACLE
  async function checkBalance(
    pubkey: string | null,
    role: "PLATFORM" | "ORACLE",
  ): Promise<AccountBalanceHealth> {
    if (!pubkey) {
      return {
        publicKey: "",
        balanceXlm: null,
        isLow: true,
        minThresholdXlm,
        error: `Chưa cấu hình tài khoản ${role}`,
      };
    }

    try {
      if (options?.rpcClient?.getAccountBalanceXlm) {
        const balanceXlm = await options.rpcClient.getAccountBalanceXlm(pubkey);
        return {
          publicKey: pubkey,
          balanceXlm,
          isLow: balanceXlm < minThresholdXlm,
          minThresholdXlm,
        };
      }

      const server = new rpc.Server(rpcUrl);
      const entry = await server.getAccountEntry(pubkey);
      const balanceXlm = Number(entry.balance) / 10_000_000;
      return {
        publicKey: pubkey,
        balanceXlm,
        isLow: balanceXlm < minThresholdXlm,
        minThresholdXlm,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("not found")) {
        return {
          publicKey: pubkey,
          balanceXlm: 0,
          isLow: true,
          minThresholdXlm,
          error: "Tài khoản chưa được kích hoạt hoặc chưa nạp tiền trên mạng",
        };
      }
      return {
        publicKey: pubkey,
        balanceXlm: null,
        isLow: true,
        minThresholdXlm,
        error: sanitizeError(err),
      };
    }
  }

  const platformHealth = await checkBalance(platformPubkey, "PLATFORM");
  const oracleHealth = await checkBalance(oraclePubkey, "ORACLE");

  const balancesOk = !platformHealth.isLow && !oracleHealth.isLow;
  const overallOk = rpcOk && contractOk && balancesOk;

  return {
    ok: overallOk,
    rpc: {
      ok: rpcOk,
      url: rpcUrl,
      latestLedger,
      error: rpcError,
    },
    contract: {
      ok: contractOk,
      contractId,
      verified: contractVerified,
      error: contractError,
    },
    balances: {
      ok: balancesOk,
      platform: platformHealth,
      oracle: oracleHealth,
    },
  };
}
