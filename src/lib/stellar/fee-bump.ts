import { TransactionBuilder, Transaction, FeeBumpTransaction, Keypair, Networks } from "@stellar/stellar-sdk";

/**
 * Xây dựng giao dịch Fee-Bump (CAP-0015).
 * Tài khoản PLATFORM trả phí thay cho giao dịch bên trong của người dùng.
 *
 * Lưu ý: Fee-Bump là P1. Nếu môi trường hoặc RPC Soroban gặp vấn đề với Fee-Bump,
 * hệ thống tự động fallback sang cơ chế PLATFORM làm source account trực tiếp.
 */
export function buildFeeBumpTx(
  innerTx: Transaction,
  feeSourceKeypair: Keypair,
  networkPassphrase: string = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
  baseFee: string = "200",
): FeeBumpTransaction {
  // Giao dịch Soroban có phí tài nguyên lớn trong innerTx.fee; phí fee-bump phải không thấp hơn mức này.
  const innerRate = BigInt(innerTx.fee) / BigInt(Math.max(innerTx.operations.length, 1));
  const effectiveBaseFee = BigInt(baseFee) >= innerRate ? baseFee : (innerRate + 1000n).toString();

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    feeSourceKeypair.publicKey(),
    effectiveBaseFee,
    innerTx,
    networkPassphrase,
  );

  feeBump.sign(feeSourceKeypair);
  return feeBump;
}

/**
 * Kiểm tra xem cấu hình có bật Fee-Bump hay không.
 */
export function isFeeBumpEnabled(): boolean {
  return process.env.STELLAR_ENABLE_FEE_BUMP === "true";
}
