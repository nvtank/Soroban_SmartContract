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
  private accountExistsMap: Map<string, boolean> = new Map();
  private defaultAccountExists = true;
  private friendbotSuccess = true;
  private accountBalanceMap: Map<string, number> = new Map();
  private simulateContractError?: string;
  private latestLedgerSequence = 1000;

  constructor(contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM", networkPassphrase = DEFAULT_NETWORK_PASSPHRASE) {
    this.contractId = contractId;
    this.networkPassphrase = networkPassphrase;
  }

  getContractId(): string {
    return this.contractId;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  setNetworkPassphrase(phrase: string): void {
    this.networkPassphrase = phrase;
  }

  setAccountExists(publicKey: string, exists: boolean): void {
    this.accountExistsMap.set(publicKey, exists);
  }

  setDefaultAccountExists(exists: boolean): void {
    this.defaultAccountExists = exists;
  }

  setFriendbotSuccess(success: boolean): void {
    this.friendbotSuccess = success;
  }

  setAccountBalance(publicKey: string, xlm: number): void {
    this.accountBalanceMap.set(publicKey, xlm);
  }

  setSimulateContractError(error?: string): void {
    this.simulateContractError = error;
  }

  setLatestLedgerSequence(seq: number): void {
    this.latestLedgerSequence = seq;
  }

  async getLatestLedgerSequence(): Promise<number> {
    return this.latestLedgerSequence;
  }

  async accountExists(publicKey: string): Promise<boolean> {
    if (this.accountExistsMap.has(publicKey)) {
      return this.accountExistsMap.get(publicKey)!;
    }
    return this.defaultAccountExists;
  }

  async fundTestnetAccount(publicKey: string): Promise<boolean> {
    const isTestnet =
      this.networkPassphrase === Networks.TESTNET ||
      this.networkPassphrase === "Test SDF Network ; September 2015";
    if (!isTestnet) {
      return false;
    }
    if (this.friendbotSuccess) {
      this.accountExistsMap.set(publicKey, true);
      return true;
    }
    return false;
  }

  async getAccountBalanceXlm(publicKey: string): Promise<number> {
    return this.accountBalanceMap.get(publicKey) ?? 100;
  }

  async buildAndSimulate(params: { action: string; args: xdr.ScVal[]; sourcePublicKey: string }): Promise<{
    transaction: Transaction;
    authEntries: xdr.SorobanAuthorizationEntry[];
  }> {
    if (this.simulateContractError) {
      throw new Error(this.simulateContractError);
    }

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
