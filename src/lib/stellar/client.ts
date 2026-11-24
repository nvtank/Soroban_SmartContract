import {
  rpc,
  Contract,
  Transaction,
  FeeBumpTransaction,
  TransactionBuilder,
  Operation,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import type { StellarRpcClient, StellarRpcConfig, SubmitResult, TxStatusResult } from "./types";
import { sanitizeError } from "./pii";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Soroban RPC Client kết nối trực tiếp tới Stellar Soroban RPC.
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
      throw new Error("Chưa cấu hình STELLAR_CONTRACT_ID trên hệ thống.");
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

    // Auth entries do bước simulate ghi lại nằm ngay trên operation (Operation.auth)
    const operation = preparedTx.operations[0] as { auth?: xdr.SorobanAuthorizationEntry[] } | undefined;
    const authEntries: xdr.SorobanAuthorizationEntry[] = operation?.auth ? [...operation.auth] : [];

    return {
      transaction: preparedTx,
      authEntries,
    };
  }

  async getLatestLedgerSequence(): Promise<number> {
    const latest = await this.server.getLatestLedger();
    return latest.sequence;
  }

  applyAuthEntries(tx: Transaction, signed: xdr.SorobanAuthorizationEntry[]): Transaction {
    const operation = tx.operations[0] as { func: xdr.HostFunction } | undefined;
    if (!operation) throw new Error("Giao dịch không có operation để gắn chữ ký.");

    // cloneFrom không giữ dữ liệu tài nguyên Soroban (footprint, phí tài nguyên) nên phải gắn lại,
    // nếu không mạng sẽ từ chối giao dịch với mã "malformed".
    const envelope = tx.toEnvelope() as unknown as {
      v1?: { tx?: { ext?: { sorobanData?: xdr.SorobanTransactionData } } };
    };
    const sorobanData = envelope.v1?.tx?.ext?.sorobanData;
    if (!sorobanData) throw new Error("Giao dịch thiếu dữ liệu tài nguyên Soroban sau khi simulate.");

    // tx.fee gồm phí cơ sở và phí tài nguyên; setSorobanData cộng phí tài nguyên một lần nữa nên phải trừ trước.
    const baseFee = (
      BigInt(tx.fee) - BigInt(String((sorobanData as unknown as { resourceFee: unknown }).resourceFee))
    ).toString();

    return TransactionBuilder.cloneFrom(tx, { fee: baseFee, networkPassphrase: this.networkPassphrase })
      .clearOperations()
      .addOperation(Operation.invokeHostFunction({ func: operation.func, auth: signed }))
      .setSorobanData(sorobanData)
      .build();
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
 * Khởi tạo Soroban RPC client từ biến môi trường hoặc config truyền vào.
 */
export function getStellarClient(config?: Partial<StellarRpcConfig>): StellarRpcClient {
  // Cấu hình truyền vào (kể cả chuỗi rỗng) luôn thắng biến môi trường
  const contractId = config?.contractId ?? process.env.STELLAR_CONTRACT_ID ?? "";

  return new SorobanRpcClient({
    rpcUrl: config?.rpcUrl || process.env.STELLAR_RPC_URL || DEFAULT_RPC_URL,
    networkPassphrase:
      config?.networkPassphrase || process.env.STELLAR_NETWORK_PASSPHRASE || DEFAULT_NETWORK_PASSPHRASE,
    contractId,
    explorerTxUrl: config?.explorerTxUrl || process.env.STELLAR_EXPLORER_TX_URL,
    friendbotUrl: config?.friendbotUrl || process.env.STELLAR_FRIENDBOT_URL,
  });
}
