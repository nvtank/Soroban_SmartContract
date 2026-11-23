import crypto from "node:crypto";
import {
  rpc,
  Contract,
  Transaction,
  FeeBumpTransaction,
  TransactionBuilder,
  Networks,
  Keypair,
  Account,
  xdr,
} from "@stellar/stellar-sdk";
import type { StellarRpcClient, StellarRpcConfig, SubmitResult, TxStatusResult } from "./types";
import { sanitizeError } from "./pii";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Mock RPC Client dùng khi chưa có STELLAR_CONTRACT_ID hoặc trong môi trường test độc lập.
 */
export class MockStellarRpcClient implements StellarRpcClient {
  private contractId: string;
  private networkPassphrase: string;
  private txStore: Map<string, { status: "SUCCESS" | "FAILED"; ledger: number; error?: string }> = new Map();

  constructor(contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM") {
    this.contractId = contractId;
    this.networkPassphrase = DEFAULT_NETWORK_PASSPHRASE;
  }

  isMock(): boolean {
    return true;
  }

  getContractId(): string {
    return this.contractId;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  async buildAndSimulate(params: { action: string; args: xdr.ScVal[]; sourcePublicKey: string }): Promise<{
    transaction: Transaction;
    authEntries: xdr.SorobanAuthorizationEntry[];
  }> {
    const dummyAccount = new Keypair({ type: "ed25519", publicKey: Buffer.alloc(32) });
    const acc = new Account(params.sourcePublicKey, "100");
    const contract = new Contract(this.contractId);
    const op = contract.call(params.action, ...params.args);

    const tx = new TransactionBuilder(acc, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    return {
      transaction: tx,
      authEntries: [],
    };
  }

  async submitTransaction(_tx: Transaction | FeeBumpTransaction): Promise<SubmitResult> {
    const txHash = crypto.randomBytes(32).toString("hex").toLowerCase();
    this.txStore.set(txHash, { status: "SUCCESS", ledger: 1000 + this.txStore.size });
    return {
      txHash,
      status: "SUCCESS",
    };
  }

  async getTransaction(txHash: string): Promise<TxStatusResult> {
    const item = this.txStore.get(txHash.toLowerCase());
    if (!item) {
      // Giả lập trạng thái đã thành công cho bất kỳ hash hợp lệ nào trong mock
      return {
        status: "SUCCESS",
        txHash,
        ledger: 1001,
      };
    }
    return {
      status: item.status,
      txHash,
      ledger: item.ledger,
      error: item.error,
    };
  }

  async pollTransaction(txHash: string, _timeoutMs = 8000, _intervalMs = 1000): Promise<TxStatusResult> {
    return this.getTransaction(txHash);
  }

  // Tiện ích hỗ trợ test giả lập lỗi
  setTxFailure(txHash: string, error: string): void {
    this.txStore.set(txHash.toLowerCase(), { status: "FAILED", ledger: 1002, error });
  }
}

/**
 * Soroban RPC Client thật kết nối tới Stellar Soroban RPC Testnet.
 */
export class SorobanRpcClient implements StellarRpcClient {
  private server: rpc.Server;
  private contractId: string;
  private networkPassphrase: string;

  constructor(config: StellarRpcConfig) {
    this.server = new rpc.Server(config.rpcUrl || DEFAULT_RPC_URL);
    this.contractId = config.contractId || "";
    this.networkPassphrase = config.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE;
  }

  isMock(): boolean {
    return false;
  }

  getContractId(): string {
    return this.contractId;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  async buildAndSimulate(params: { action: string; args: xdr.ScVal[]; sourcePublicKey: string }): Promise<{
    transaction: Transaction;
    authEntries: xdr.SorobanAuthorizationEntry[];
  }> {
    if (!this.contractId) {
      throw new Error("STELLAR_CONTRACT_ID is not configured");
    }

    const account = await this.server.getAccount(params.sourcePublicKey);
    const contract = new Contract(this.contractId);
    const op = contract.call(params.action, ...params.args);

    const baseTx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const preparedTx = await this.server.prepareTransaction(baseTx);

    // Lấy danh sách auth entries cần ký từ thao tác
    const opBody = preparedTx.operations[0] as any;
    const authEntries: xdr.SorobanAuthorizationEntry[] = opBody?.body?.invokeHostFunctionOp?.auth || [];

    return {
      transaction: preparedTx,
      authEntries,
    };
  }

  async submitTransaction(tx: Transaction | FeeBumpTransaction): Promise<SubmitResult> {
    try {
      const response = await this.server.sendTransaction(tx);
      const txHash = response.hash;

      if (response.status === "ERROR") {
        return {
          txHash,
          status: "FAILED",
          error: sanitizeError(response.errorResult?.toXDR("hex") || "Submission error"),
        };
      }

      return {
        txHash,
        status: (response.status as string) === "SUCCESS" ? "SUCCESS" : "PENDING",
      };
    } catch (err) {
      return {
        txHash: "",
        status: "FAILED",
        error: sanitizeError(err),
      };
    }
  }

  async getTransaction(txHash: string): Promise<TxStatusResult> {
    try {
      const txRes = await this.server.getTransaction(txHash);
      if (txRes.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          status: "SUCCESS",
          txHash,
          ledger: txRes.latestLedger,
        };
      }
      if (txRes.status === rpc.Api.GetTransactionStatus.FAILED) {
        return {
          status: "FAILED",
          txHash,
          ledger: txRes.latestLedger,
          error: sanitizeError("Transaction execution failed on ledger"),
        };
      }
      if (txRes.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        return {
          status: "NOT_FOUND",
          txHash,
        };
      }
      return {
        status: "PENDING",
        txHash,
      };
    } catch (err) {
      return {
        status: "FAILED",
        txHash,
        error: sanitizeError(err),
      };
    }
  }

  async pollTransaction(txHash: string, timeoutMs = 8000, intervalMs = 1000): Promise<TxStatusResult> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const res = await this.getTransaction(txHash);
      if (res.status === "SUCCESS" || res.status === "FAILED") {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return {
      status: "PENDING",
      txHash,
    };
  }
}

/**
 * Khởi tạo client Stellar RPC phù hợp:
 * - Nếu STELLAR_CONTRACT_ID chưa có trong env: tự động dùng Mock client để luồng nghiệp vụ không bị gián đoạn.
 * - Khi có STELLAR_CONTRACT_ID: kết nối trực tiếp RPC Soroban Testnet.
 */
export function getStellarClient(config?: Partial<StellarRpcConfig>): StellarRpcClient {
  const contractId = config?.contractId || process.env.STELLAR_CONTRACT_ID;
  const isMock = config?.isMock || !contractId;

  if (isMock) {
    return new MockStellarRpcClient(contractId || undefined);
  }

  return new SorobanRpcClient({
    rpcUrl: config?.rpcUrl || process.env.STELLAR_RPC_URL || DEFAULT_RPC_URL,
    networkPassphrase:
      config?.networkPassphrase || process.env.STELLAR_NETWORK_PASSPHRASE || DEFAULT_NETWORK_PASSPHRASE,
    contractId,
    explorerTxUrl: config?.explorerTxUrl || process.env.STELLAR_EXPLORER_TX_URL,
    friendbotUrl: config?.friendbotUrl || process.env.STELLAR_FRIENDBOT_URL,
  });
}
