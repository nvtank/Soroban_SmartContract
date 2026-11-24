import type { OnchainTxStatus } from "@/domain/states";
import type { Keypair, Transaction, FeeBumpTransaction, xdr } from "@stellar/stellar-sdk";

export type OnchainSigner = { kind: "USER"; userId: string } | { kind: "ORACLE" } | { kind: "PLATFORM" };

export type CanonicalContractInput = {
  contract_id: string;
  room_label: string;
  rent_amount: string;
  deposit_amount: string;
  start_date: string;
  end_date: string;
  due_day: number;
  late_fee_bps_per_day: number;
  terms_text: string;
};

export type OnchainTxRecord = {
  id: string;
  contract_id: string;
  action: string;
  args: Record<string, unknown> | unknown[];
  signer: OnchainSigner;
  payload_hash: string;
  status: OnchainTxStatus;
  tx_hash: string | null;
  error: string | null;
  retry_count: number;
  created_at: string;
  updated_at?: string;
  locked_at?: string | null;
  locked_by?: string | null;
};

export type StellarRpcConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  contractId?: string;
  platformSecret?: string;
  oracleSecret?: string;
  adminSecret?: string;
  explorerTxUrl?: string;
  friendbotUrl?: string;
};

export type SubmitResult = {
  txHash: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error?: string;
};

export type TxStatusResult = {
  status: "SUCCESS" | "FAILED" | "NOT_FOUND" | "PENDING";
  txHash: string;
  ledger?: number;
  error?: string;
};

export interface StellarRpcClient {
  getContractId(): string;
  getNetworkPassphrase(): string;
  buildAndSimulate(params: { action: string; args: xdr.ScVal[]; sourcePublicKey: string }): Promise<{
    transaction: Transaction;
    authEntries: xdr.SorobanAuthorizationEntry[];
  }>;
  /** Ledger hiện tại, dùng để đặt thời hạn cho chữ ký auth entry. */
  getLatestLedgerSequence?(): Promise<number>;
  /** Dựng lại giao dịch với các auth entry đã ký (Operation.auth là bất biến sau khi build). */
  applyAuthEntries?(tx: Transaction, signed: xdr.SorobanAuthorizationEntry[]): Transaction;
  submitTransaction(tx: Transaction | FeeBumpTransaction): Promise<SubmitResult>;
  getTransaction(txHash: string): Promise<TxStatusResult>;
  pollTransaction(txHash: string, timeoutMs?: number, intervalMs?: number): Promise<TxStatusResult>;
  /** Kiểm tra tài khoản đã tồn tại trên ledger hay chưa */
  accountExists?(publicKey: string): Promise<boolean>;
  /** Nạp tiền vào tài khoản Testnet qua Friendbot với thử lại có giới hạn */
  fundTestnetAccount?(publicKey: string, maxAttempts?: number): Promise<boolean>;
  /** Lấy số dư XLM của tài khoản */
  getAccountBalanceXlm?(publicKey: string): Promise<number>;
}

export type CustodySignerCallback = <T>(
  db: unknown,
  userId: string,
  fn: (keypair: Keypair) => Promise<T>,
) => Promise<T>;

export type OutboxDeps = {
  stellarClient?: StellarRpcClient;
  withCustodyKeypair?: CustodySignerCallback;
  getPlatformKeypair?: () => Keypair;
  getOracleKeypair?: () => Keypair;
  now?: () => Date;
};
