import crypto from "node:crypto";
import {
  Contract,
  Transaction,
  FeeBumpTransaction,
  TransactionBuilder,
  Networks,
  Account,
  xdr,
} from "@stellar/stellar-sdk";
import type { StellarRpcClient, SubmitResult, TxStatusResult } from "@/lib/stellar/types";

const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Mock RPC Client dùng riêng cho testing, tiêm qua dependency injection.
 * Không tồn tại trong code runtime production.
 */
export class MockStellarRpcClient implements StellarRpcClient {
  private contractId: string;
  private networkPassphrase: string;
  private txStore: Map<string, { status: "SUCCESS" | "FAILED"; ledger: number; error?: string }> = new Map();

  constructor(contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM") {
    this.contractId = contractId;
    this.networkPassphrase = DEFAULT_NETWORK_PASSPHRASE;
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

  async submitTransaction(_tx?: Transaction | FeeBumpTransaction): Promise<SubmitResult> {
    void _tx;
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

  async pollTransaction(txHash: string, _timeoutMs?: number, _intervalMs?: number): Promise<TxStatusResult> {
    void _timeoutMs;
    void _intervalMs;
    return this.getTransaction(txHash);
  }

  setTxFailure(txHash: string, error: string): void {
    this.txStore.set(txHash.toLowerCase(), { status: "FAILED", ledger: 1002, error });
  }
}
