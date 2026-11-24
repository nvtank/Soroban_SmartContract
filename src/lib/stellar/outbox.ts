import crypto from "node:crypto";
import { Keypair, authorizeEntry, Transaction, FeeBumpTransaction } from "@stellar/stellar-sdk";
import type { OnchainTxDto } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import type { OnchainSigner, OnchainTxRecord, OutboxDeps } from "./types";
import { assertNoPii, sanitizeError } from "./pii";
import { encodeContractArgs } from "./abi";
import { getStellarClient } from "./client";
import { getExplorerTxUrl } from "./explorer";
import { buildFeeBumpTx, isFeeBumpEnabled } from "./fee-bump";

const MAX_RETRIES = 5;
const DEFAULT_POLL_TIMEOUT_MS = 6000;

type GenericDb = {
  from?: (table: string) => {
    insert: (record: unknown) => Promise<{ error: unknown }>;
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => {
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{ data: OnchainTxRecord[] | null; error: unknown }>;
        };
      };
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: OnchainTxRecord | null; error: unknown }>;
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: OnchainTxRecord[] | null; error: unknown }>;
      };
    };
    update: (updates: unknown) => {
      eq: (
        column: string,
        val: string,
      ) => {
        eq: (
          col2: string,
          val2: string,
        ) => {
          select: (col3: string) => Promise<{ data: Array<{ id: string }> | null; error: unknown }>;
        };
      } & Promise<{ error: unknown }>;
    };
  };
  onchain_txs?: OnchainTxRecord[];
};

function resolvePlatformKeypair(): Keypair {
  const secret = process.env.STELLAR_PLATFORM_SECRET;
  if (secret && secret.startsWith("S") && secret.length === 56) {
    return Keypair.fromSecret(secret);
  }
  return Keypair.random();
}

function resolveOracleKeypair(platformKeypair: Keypair): Keypair {
  const secret = process.env.STELLAR_ORACLE_SECRET;
  if (secret && secret.startsWith("S") && secret.length === 56) {
    return Keypair.fromSecret(secret);
  }
  return platformKeypair;
}

/**
 * Đưa giao dịch vào outbox onchain_txs.
 * Kiểm tra PII nghiêm ngặt trước khi ghi nhận.
 */
export async function enqueueOnchain(
  db: unknown,
  params: {
    contractId: string;
    action: string;
    args: Record<string, unknown> | unknown[];
    signer: OnchainSigner;
  },
  deps?: Partial<OutboxDeps>,
): Promise<{ id: string }> {
  // 1. Chặn PII
  assertNoPii(params.args, params.action);

  // 2. Kiểm tra tính hợp lệ của tham số theo ABI
  encodeContractArgs(params.action, params.args);

  // 3. Tính toán payload_hash chuẩn tắc
  const canonicalPayload = JSON.stringify({
    contractId: params.contractId,
    action: params.action,
    args: params.args,
    signer: params.signer,
  });
  const payloadHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

  const id = crypto.randomUUID();
  const now = (deps?.now ? deps.now() : new Date()).toISOString();

  const record: OnchainTxRecord = {
    id,
    contract_id: params.contractId,
    action: params.action,
    args: params.args,
    signer: params.signer,
    payload_hash: payloadHash,
    status: "PENDING",
    tx_hash: null,
    error: null,
    retry_count: 0,
    created_at: now,
  };

  const genericDb = db as GenericDb | null | undefined;
  if (genericDb && typeof genericDb.from === "function") {
    const { error } = await genericDb.from("onchain_txs").insert(record);
    if (error) {
      throw new ApiError("INTERNAL_ERROR", error, "Lỗi khi lưu giao dịch on-chain vào outbox");
    }
  } else if (genericDb && Array.isArray(genericDb.onchain_txs)) {
    genericDb.onchain_txs.push(record);
  }

  return { id };
}

/**
 * Xử lý hàng đợi onchain_txs:
 * - Claim chống xử lý trùng (chỉ claim các bản ghi PENDING)
 * - Giữ thứ tự FIFO theo từng hợp đồng
 * - Thiếu cấu hình STELLAR_CONTRACT_ID: đánh dấu FAILED ngay, không có tx_hash, giữ nguyên nghiệp vụ off-chain
 * - Đối soát giao dịch đã SUBMITTED, không submit lại mù
 * - Bounded polling phù hợp với timeout Vercel
 * - Làm sạch lỗi, không log secret
 */
export async function flushOnchain(
  db: unknown,
  options?: { limit?: number; pollTimeoutMs?: number },
  deps?: Partial<OutboxDeps>,
): Promise<{ confirmed: number; failed: number }> {
  const limit = options?.limit ?? 20;
  const pollTimeout = options?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const client = deps?.stellarClient ?? getStellarClient();
  const platformKeypair = deps?.getPlatformKeypair ? deps.getPlatformKeypair() : resolvePlatformKeypair();
  const oracleKeypair = deps?.getOracleKeypair
    ? deps.getOracleKeypair()
    : resolveOracleKeypair(platformKeypair);

  let confirmed = 0;
  let failed = 0;

  const genericDb = db as GenericDb | null | undefined;
  let records: OnchainTxRecord[] = [];

  if (genericDb && typeof genericDb.from === "function") {
    const { data, error } = await genericDb
      .from("onchain_txs")
      .select("*")
      .in("status", ["PENDING", "SUBMITTED", "FAILED"])
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw new ApiError("INTERNAL_ERROR", error, "Không thể đọc hàng đợi onchain_txs");
    records = data || [];
  } else if (genericDb && Array.isArray(genericDb.onchain_txs)) {
    records = [...genericDb.onchain_txs]
      .filter((r: OnchainTxRecord) => ["PENDING", "SUBMITTED", "FAILED"].includes(r.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }

  if (records.length === 0) {
    return { confirmed: 0, failed: 0 };
  }

  // 2. Gom nhóm theo contract_id để giữ thứ tự FIFO
  const contractQueues = new Map<string, OnchainTxRecord[]>();
  for (const r of records) {
    const list = contractQueues.get(r.contract_id) || [];
    list.push(r);
    contractQueues.set(r.contract_id, list);
  }

  // Helper cập nhật DB
  async function updateRecord(id: string, updates: Partial<OnchainTxRecord>) {
    if (genericDb && typeof genericDb.from === "function") {
      await genericDb.from("onchain_txs").update(updates).eq("id", id);
    } else if (genericDb && Array.isArray(genericDb.onchain_txs)) {
      const idx = genericDb.onchain_txs.findIndex((x: OnchainTxRecord) => x.id === id);
      if (idx !== -1) {
        genericDb.onchain_txs[idx] = { ...genericDb.onchain_txs[idx], ...updates };
      }
    }
  }

  // 3. Xử lý từng hợp đồng
  for (const queue of contractQueues.values()) {
    const head = queue[0];

    // TRƯỜNG HỢP 1: Đầu hàng đợi là FAILED -> Chặn các tx sau của cùng hợp đồng
    if (head.status === "FAILED") {
      continue;
    }

    // TRƯỜNG HỢP 2: Đầu hàng đợi là SUBMITTED -> Đối soát, không submit lại mù
    if (head.status === "SUBMITTED" && head.tx_hash) {
      const checkRes = await client.getTransaction(head.tx_hash);
      if (checkRes.status === "SUCCESS") {
        await updateRecord(head.id, { status: "CONFIRMED", error: null });
        confirmed++;
        continue;
      }
      if (checkRes.status === "FAILED") {
        await updateRecord(head.id, {
          status: "FAILED",
          error: sanitizeError(checkRes.error || "Giao dịch thất bại trên ledger"),
        });
        failed++;
        continue;
      }
      // Vẫn đang PENDING: poll có giới hạn thời gian
      const pollRes = await client.pollTransaction(head.tx_hash, pollTimeout, 1000);
      if (pollRes.status === "SUCCESS") {
        await updateRecord(head.id, { status: "CONFIRMED", error: null });
        confirmed++;
      } else if (pollRes.status === "FAILED") {
        await updateRecord(head.id, {
          status: "FAILED",
          error: sanitizeError(pollRes.error || "Giao dịch thất bại khi kiểm tra"),
        });
        failed++;
      }
      continue;
    }

    // TRƯỜNG HỢP 3: Đầu hàng đợi là PENDING
    if (head.status === "PENDING") {
      // Yêu cầu (2): Kiểm tra cấu hình Stellar. Nếu thiếu STELLAR_CONTRACT_ID -> đánh dấu FAILED,
      // tuyệt đối không có tx_hash, giữ nguyên nghiệp vụ off-chain và cho phép retry sau.
      if (!client.getContractId()) {
        await updateRecord(head.id, {
          status: "FAILED",
          error: "Hệ thống blockchain chưa được cấu hình (thiếu STELLAR_CONTRACT_ID). Vui lòng thử lại sau.",
          tx_hash: null,
        });
        failed++;
        continue;
      }

      // Kiểm tra số lần thử lại tối đa
      if (head.retry_count >= MAX_RETRIES) {
        await updateRecord(head.id, {
          status: "FAILED",
          error: "Giao dịch đã vượt quá số lần thử lại tối đa (5).",
        });
        failed++;
        continue;
      }

      // Claim giao dịch để chống xử lý trùng (chỉ update khi status vẫn là PENDING)
      let claimSuccess = false;
      if (genericDb && typeof genericDb.from === "function") {
        const { data, error } = await genericDb
          .from("onchain_txs")
          .update({
            status: "SUBMITTED",
            retry_count: head.retry_count + 1,
            error: null,
          })
          .eq("id", head.id)
          .eq("status", "PENDING")
          .select("id");

        if (!error && data && data.length > 0) {
          claimSuccess = true;
        }
      } else {
        if (head.status === "PENDING") {
          head.status = "SUBMITTED";
          head.retry_count += 1;
          claimSuccess = true;
        }
      }

      if (!claimSuccess) {
        continue; // Bị worker khác claim trước
      }

      try {
        // Encode tham số theo ABI
        const scVals = encodeContractArgs(head.action, head.args);

        // Build & Simulate giao dịch Soroban
        const { transaction, authEntries } = await client.buildAndSimulate({
          action: head.action,
          args: scVals,
          sourcePublicKey: platformKeypair.publicKey(),
        });

        // Ký Auth Entries nếu cần
        if (authEntries.length > 0) {
          if (head.signer.kind === "USER") {
            const userId = head.signer.userId;
            if (deps?.withCustodyKeypair) {
              await deps.withCustodyKeypair(db, userId, async (custodyKeypair) => {
                for (let i = 0; i < authEntries.length; i++) {
                  authEntries[i] = await authorizeEntry(
                    authEntries[i],
                    custodyKeypair,
                    1000,
                    client.getNetworkPassphrase(),
                  );
                }
              });
            }
          } else if (head.signer.kind === "ORACLE") {
            for (let i = 0; i < authEntries.length; i++) {
              authEntries[i] = await authorizeEntry(
                authEntries[i],
                oracleKeypair,
                1000,
                client.getNetworkPassphrase(),
              );
            }
          }
        }

        // Ký phong bì giao dịch bằng khóa PLATFORM
        transaction.sign(platformKeypair);

        // Kiểm tra xem có bật Fee-Bump (CAP-0015, P1) hay không
        let txToSubmit: Transaction | FeeBumpTransaction = transaction;
        if (isFeeBumpEnabled()) {
          try {
            txToSubmit = buildFeeBumpTx(transaction, platformKeypair, client.getNetworkPassphrase());
          } catch {
            txToSubmit = transaction;
          }
        }

        // Submit giao dịch
        const subRes = await client.submitTransaction(txToSubmit);
        if (subRes.status === "FAILED") {
          await updateRecord(head.id, {
            status: "FAILED",
            error: sanitizeError(subRes.error || "Giao dịch bị từ chối khi submit"),
          });
          failed++;
          continue;
        }

        const txHash = subRes.txHash;
        await updateRecord(head.id, { tx_hash: txHash });

        // Poll có giới hạn thời gian phù hợp với serverless
        const pollRes = await client.pollTransaction(txHash, pollTimeout, 1000);
        if (pollRes.status === "SUCCESS") {
          await updateRecord(head.id, { status: "CONFIRMED", error: null });
          confirmed++;
        } else if (pollRes.status === "FAILED") {
          await updateRecord(head.id, {
            status: "FAILED",
            error: sanitizeError(pollRes.error || "Giao dịch thất bại trên ledger"),
          });
          failed++;
        }
      } catch (err) {
        await updateRecord(head.id, {
          status: "FAILED",
          error: sanitizeError(err),
        });
        failed++;
      }
    }
  }

  return { confirmed, failed };
}

/**
 * Thử lại một giao dịch on-chain đã FAILED.
 * Chuyển trạng thái từ FAILED về PENDING và xóa lỗi cũ.
 */
export async function retryOnchainTx(
  db: unknown,
  txId: string,
  deps?: Partial<OutboxDeps>,
): Promise<OnchainTxDto> {
  const genericDb = db as GenericDb | null | undefined;
  let record: OnchainTxRecord | null = null;

  if (genericDb && typeof genericDb.from === "function") {
    const { data, error } = await genericDb.from("onchain_txs").select("*").eq("id", txId).maybeSingle();

    if (error || !data) {
      throw new ApiError("NOT_FOUND", { txId }, "Không tìm thấy giao dịch on-chain");
    }
    record = data;
  } else if (genericDb && Array.isArray(genericDb.onchain_txs)) {
    record = genericDb.onchain_txs.find((x: OnchainTxRecord) => x.id === txId) || null;
    if (!record) {
      throw new ApiError("NOT_FOUND", { txId }, "Không tìm thấy giao dịch on-chain");
    }
  }

  if (!record) {
    throw new ApiError("NOT_FOUND", { txId }, "Không tìm thấy giao dịch on-chain");
  }

  if (record.status !== "FAILED") {
    throw new ApiError(
      "INVALID_TRANSITION",
      { currentStatus: record.status },
      "Chỉ có thể thử lại các giao dịch ở trạng thái THẤT BẠI (FAILED)",
    );
  }

  const updates: Partial<OnchainTxRecord> = {
    status: "PENDING",
    error: null,
  };

  if (genericDb && typeof genericDb.from === "function") {
    const { error: updateErr } = await genericDb.from("onchain_txs").update(updates).eq("id", txId);
    if (updateErr) {
      throw new ApiError("INTERNAL_ERROR", updateErr, "Không thể cập nhật trạng thái thử lại");
    }
  } else if (genericDb && Array.isArray(genericDb.onchain_txs)) {
    const idx = genericDb.onchain_txs.findIndex((x: OnchainTxRecord) => x.id === txId);
    if (idx !== -1) {
      genericDb.onchain_txs[idx] = { ...genericDb.onchain_txs[idx], ...updates };
    }
  }

  record = { ...record, ...updates };

  try {
    await flushOnchain(db, { limit: 5, pollTimeoutMs: 3000 }, deps);
  } catch {
    // Background worker sẽ tiếp tục xử lý
  }

  return {
    id: record.id,
    contractId: record.contract_id,
    action: record.action,
    payloadHash: record.payload_hash,
    status: record.status,
    txHash: record.tx_hash,
    explorerUrl: record.tx_hash ? getExplorerTxUrl(record.tx_hash) : null,
    error: record.error,
    retryCount: record.retry_count,
    createdAt: record.created_at,
  };
}

/**
 * Lấy danh sách giao dịch on-chain của hợp đồng dưới dạng OnchainTxDto (đã khử PII và thêm explorerUrl).
 */
export async function getContractOnchainTxs(db: unknown, contractId: string): Promise<OnchainTxDto[]> {
  const genericDb = db as GenericDb | null | undefined;
  let list: OnchainTxRecord[] = [];

  if (genericDb && typeof genericDb.from === "function") {
    const { data, error } = await genericDb
      .from("onchain_txs")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError("INTERNAL_ERROR", error, "Lỗi khi lấy danh sách giao dịch on-chain");
    }
    list = data || [];
  } else if (genericDb && Array.isArray(genericDb.onchain_txs)) {
    list = genericDb.onchain_txs
      .filter((x: OnchainTxRecord) => x.contract_id === contractId)
      .sort((a: OnchainTxRecord, b: OnchainTxRecord) => a.created_at.localeCompare(b.created_at));
  }

  return list.map((item) => ({
    id: item.id,
    contractId: item.contract_id,
    action: item.action,
    payloadHash: item.payload_hash,
    status: item.status,
    txHash: item.tx_hash,
    explorerUrl: item.tx_hash ? getExplorerTxUrl(item.tx_hash) : null,
    error: item.error,
    retryCount: item.retry_count,
    createdAt: item.created_at,
  }));
}
