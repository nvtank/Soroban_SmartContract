import crypto from "node:crypto";
import { Address, Keypair, authorizeEntry, Transaction, FeeBumpTransaction, xdr } from "@stellar/stellar-sdk";
import type { OnchainTxDto } from "@/domain/dto";
import { ApiError } from "@/lib/api/http";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustodySignerCallback, OnchainSigner, OnchainTxRecord, OutboxDeps } from "./types";
import { assertNoPii, sanitizeError } from "./pii";
import { encodeContractArgs } from "./abi";
import { completeAbiArgs, isAbiComplete } from "./resolve-args";
import { getStellarClient } from "./client";
import { getExplorerTxUrl } from "./explorer";
import { buildFeeBumpTx, isFeeBumpEnabled } from "./fee-bump";

const MAX_RETRIES = 5;

/** Mặc định: ký auth entry của người dùng bằng khóa ví custody (giải mã trong bộ nhớ, không log). */
const defaultWithCustodyKeypair: CustodySignerCallback = async (db, userId, fn) => {
  const { withCustodyKeypair } = await import("@/lib/crypto/custody");
  return withCustodyKeypair(db as SupabaseClient, userId, fn);
};

/** Địa chỉ tài khoản mà auth entry yêu cầu chữ ký (null nếu entry dùng tài khoản nguồn của giao dịch). */
function authEntryAddress(entry: xdr.SorobanAuthorizationEntry): string | null {
  // SDK 17: credentials là union. Mạng trả về nhánh "sorobanCredentialsAddressV2" (trường addressV2);
  // nhánh cũ "sorobanCredentialsAddress" dùng trường address. Tài khoản nguồn thì không có trường nào.
  const credentials = entry.credentials as unknown as {
    type: string;
    address?: { address: xdr.ScAddress };
    addressV2?: { address: xdr.ScAddress };
  };
  const inner = credentials.addressV2 ?? credentials.address;
  if (!credentials.type.startsWith("sorobanCredentialsAddress") || !inner) return null;
  return Address.fromScAddress(inner.address).toString();
}

let backgroundFlushScheduled = false;

/**
 * Sau khi nghiệp vụ off-chain thành công, đẩy hàng đợi ngay sau khi trả response (bật bằng
 * ONCHAIN_AUTO_FLUSH=true). Lỗi ghi blockchain không ảnh hưởng nghiệp vụ; dòng FAILED có thể thử lại.
 */
async function scheduleBackgroundFlush(): Promise<void> {
  if (process.env.ONCHAIN_AUTO_FLUSH !== "true" || backgroundFlushScheduled) return;
  try {
    const { after } = await import("next/server");
    backgroundFlushScheduled = true;
    after(async () => {
      backgroundFlushScheduled = false;
      try {
        const { createAdminSupabase } = await import("@/lib/supabase/admin");
        const admin = createAdminSupabase();
        // Mỗi vòng chỉ xử lý giao dịch đầu hàng của từng hợp đồng (giữ đúng thứ tự), nên lặp lại
        // đến khi không còn tiến triển. Có giới hạn số vòng để không chạy vô hạn.
        for (let round = 0; round < 12; round++) {
          const { confirmed, failed } = await flushOnchain(admin, { limit: 5, pollTimeoutMs: 8000 });
          if (confirmed === 0 && failed === 0) break;
          if (failed > 0) break; // giao dịch lỗi chặn các giao dịch sau, chờ thử lại thủ công
        }
      } catch {
        // Route /api/jobs/flush-onchain hoặc nút thử lại sẽ xử lý tiếp
      }
    });
  } catch {
    backgroundFlushScheduled = false; // ngoài ngữ cảnh request
  }
}

const DEFAULT_POLL_TIMEOUT_MS = 6000;

type GenericDb = {
  /** Repository bọc client Supabase (xem DomainRepository của lớp domain). */
  db?: GenericDb;
  rpc?: (name: string, params?: unknown) => Promise<{ data: OnchainTxRecord[] | null; error: unknown }>;
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

class PlatformSequenceMutex {
  private queue: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.queue;
    this.queue = this.queue.then(() => wait);
    await prev;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

const platformSequenceMutex = new PlatformSequenceMutex();

function resolvePlatformKeypair(): Keypair | null {
  const secret = process.env.STELLAR_PLATFORM_SECRET;
  if (secret && secret.startsWith("S") && secret.length === 56) {
    try {
      return Keypair.fromSecret(secret);
    } catch {
      return null;
    }
  }
  return null;
}

function resolveOracleKeypair(platformKeypair: Keypair | null): Keypair | null {
  const secret = process.env.STELLAR_ORACLE_SECRET;
  if (secret && secret.startsWith("S") && secret.length === 56) {
    try {
      return Keypair.fromSecret(secret);
    } catch {
      return null;
    }
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

  // 2. Kiểm tra tính hợp lệ theo ABI. Tham số nghiệp vụ (chưa có địa chỉ ví) được bổ sung và kiểm tra lúc flush.
  if (isAbiComplete(params.action, params.args)) {
    encodeContractArgs(params.action, params.args);
  }

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

  const mockTarget = db as { onchain_txs?: OnchainTxRecord[] } | null | undefined;
  if (mockTarget && Array.isArray(mockTarget.onchain_txs)) {
    mockTarget.onchain_txs.push(record);
    return { id };
  }

  let genericDb = db as GenericDb | null | undefined;
  if (genericDb?.db && typeof genericDb.db.from === "function") {
    genericDb = genericDb.db;
  } else if (!genericDb || typeof genericDb.from !== "function") {
    try {
      const { createAdminSupabase } = await import("@/lib/supabase/admin");
      genericDb = createAdminSupabase() as unknown as GenericDb;
    } catch {
      // ignore
    }
  }

  if (genericDb && typeof genericDb.from === "function") {
    const { error } = await genericDb.from("onchain_txs").insert(record);
    if (error) {
      throw new ApiError("INTERNAL_ERROR", error, "Lỗi khi lưu giao dịch on-chain vào outbox");
    }
    await scheduleBackgroundFlush();
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
  options?: { limit?: number; pollTimeoutMs?: number; workerId?: string },
  deps?: Partial<OutboxDeps>,
): Promise<{ confirmed: number; failed: number }> {
  const limit = options?.limit ?? 20;
  const pollTimeout = options?.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const workerId = options?.workerId || `worker-${crypto.randomUUID()}`;
  const client = deps?.stellarClient ?? getStellarClient();
  const platformKeypair = deps?.getPlatformKeypair ? deps.getPlatformKeypair() : resolvePlatformKeypair();
  const oracleKeypair = deps?.getOracleKeypair
    ? deps.getOracleKeypair()
    : resolveOracleKeypair(platformKeypair);

  let confirmed = 0;
  let failed = 0;

  const genericDb = db as GenericDb | null | undefined;
  let records: OnchainTxRecord[] = [];
  let claimedViaRpc = false;

  // 1. Thử claim nguyên tử qua RPC function (claim_onchain_txs)
  if (genericDb && typeof genericDb.rpc === "function") {
    try {
      const { data, error } = await genericDb.rpc("claim_onchain_txs", {
        p_worker_id: workerId,
        p_limit: limit,
        p_lock_timeout_seconds: 60,
      });
      if (!error && Array.isArray(data)) {
        records = data;
        claimedViaRpc = true;
      }
    } catch {
      // Fallback cho môi trường test hoặc khi RPC chưa tạo
    }
  }

  // 2. Fallback query thông thường nếu chưa claim qua RPC
  if (!claimedViaRpc) {
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
  }

  if (records.length === 0) {
    return { confirmed: 0, failed: 0 };
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

  // 3. Gom nhóm theo contract_id để giữ thứ tự FIFO
  const candidateQueues: OnchainTxRecord[] = claimedViaRpc
    ? records
    : (() => {
        const contractQueues = new Map<string, OnchainTxRecord[]>();
        for (const r of records) {
          const list = contractQueues.get(r.contract_id) || [];
          list.push(r);
          contractQueues.set(r.contract_id, list);
        }
        const heads: OnchainTxRecord[] = [];
        for (const q of contractQueues.values()) {
          const head = q[0];
          // Nếu tx đầu tiên của hợp đồng là FAILED -> Chặn toàn bộ các tx sau của hợp đồng đó
          if (head.status !== "FAILED") {
            heads.push(head);
          }
        }
        return heads;
      })();

  // 4. Xử lý từng giao dịch đầu hàng đợi hợp đồng
  for (const head of candidateQueues) {
    if (head.status === "FAILED") {
      continue;
    }

    // TRƯỜNG HỢP A: Giao dịch là SUBMITTED -> Đối soát theo hash, không submit lại mù
    if (head.status === "SUBMITTED" && head.tx_hash) {
      const checkRes = await client.getTransaction(head.tx_hash);
      if (checkRes.status === "SUCCESS") {
        await updateRecord(head.id, { status: "CONFIRMED", error: null, locked_at: null, locked_by: null });
        confirmed++;
        continue;
      }
      if (checkRes.status === "FAILED") {
        await updateRecord(head.id, {
          status: "FAILED",
          error: sanitizeError(checkRes.error || "Giao dịch thất bại trên ledger"),
          locked_at: null,
          locked_by: null,
        });
        failed++;
        continue;
      }
      // Vẫn đang PENDING trên ledger: poll có giới hạn thời gian phù hợp Vercel
      const pollRes = await client.pollTransaction(head.tx_hash, pollTimeout, 1000);
      if (pollRes.status === "SUCCESS") {
        await updateRecord(head.id, { status: "CONFIRMED", error: null, locked_at: null, locked_by: null });
        confirmed++;
      } else if (pollRes.status === "FAILED") {
        await updateRecord(head.id, {
          status: "FAILED",
          error: sanitizeError(pollRes.error || "Giao dịch thất bại khi kiểm tra"),
          locked_at: null,
          locked_by: null,
        });
        failed++;
      } else {
        // Hết timeout vẫn PENDING: nhả lock để worker lần sau đối soát tiếp
        await updateRecord(head.id, { locked_at: null, locked_by: null });
      }
      continue;
    }

    // TRƯỜNG HỢP B: Giao dịch là PENDING
    if (head.status === "PENDING") {
      // Kiểm tra cấu hình Stellar. Nếu thiếu STELLAR_CONTRACT_ID hoặc PLATFORM secret:
      // Đánh dấu FAILED ngay, tuyệt đối không có tx_hash, giữ nguyên nghiệp vụ off-chain
      if (!client.getContractId() || !platformKeypair) {
        await updateRecord(head.id, {
          status: "FAILED",
          error:
            "Hệ thống blockchain chưa được cấu hình (thiếu STELLAR_CONTRACT_ID hoặc STELLAR_PLATFORM_SECRET). Vui lòng thử lại sau.",
          tx_hash: null,
          locked_at: null,
          locked_by: null,
        });
        failed++;
        continue;
      }

      // Kiểm tra số lần thử lại tối đa
      if (head.retry_count >= MAX_RETRIES) {
        await updateRecord(head.id, {
          status: "FAILED",
          error: "Giao dịch đã vượt quá số lần thử lại tối đa (5).",
          locked_at: null,
          locked_by: null,
        });
        failed++;
        continue;
      }

      // Claim giao dịch nếu chưa qua RPC (chống xử lý trùng giữa 2 worker)
      if (!claimedViaRpc) {
        let claimSuccess = false;
        if (genericDb && typeof genericDb.from === "function") {
          const { data, error } = await genericDb
            .from("onchain_txs")
            .update({
              status: "SUBMITTED",
              retry_count: head.retry_count + 1,
              error: null,
              locked_at: new Date().toISOString(),
              locked_by: workerId,
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
            head.locked_by = workerId;
            claimSuccess = true;
          }
        }

        if (!claimSuccess) {
          continue; // Bị worker khác claim trước
        }
      }

      try {
        // Quản lý Sequence của PLATFORM account: khóa mutex tránh đụng sequence khi chạy đồng thời
        const subRes = await platformSequenceMutex.run(async () => {
          const fullArgs = await completeAbiArgs(db, {
            action: head.action,
            args: head.args,
            contractId: head.contract_id,
            signer: head.signer,
          });
          const scVals = encodeContractArgs(head.action, fullArgs as Record<string, unknown> | unknown[]);

          const { transaction, authEntries } = await client.buildAndSimulate({
            action: head.action,
            args: scVals,
            sourcePublicKey: platformKeypair.publicKey(),
          });

          // Ký Auth Entries: chỉ ký entry đúng địa chỉ của người ký, thời hạn tính từ ledger hiện tại,
          // rồi dựng lại giao dịch vì Operation.auth là bất biến sau khi build.
          let txToSign: Transaction = transaction;
          if (authEntries.length > 0 && head.signer.kind !== "PLATFORM") {
            const latest = client.getLatestLedgerSequence ? await client.getLatestLedgerSequence() : 900;
            const validUntilLedger = latest + 100;
            const signEntriesWith = async (keypair: Keypair) => {
              for (let i = 0; i < authEntries.length; i++) {
                if (authEntryAddress(authEntries[i]) !== keypair.publicKey()) continue;
                authEntries[i] = await authorizeEntry(
                  authEntries[i],
                  keypair,
                  validUntilLedger,
                  client.getNetworkPassphrase(),
                );
              }
            };

            if (head.signer.kind === "USER") {
              const signWithCustody = deps?.withCustodyKeypair ?? defaultWithCustodyKeypair;
              await signWithCustody(db, head.signer.userId, signEntriesWith);
            } else if (head.signer.kind === "ORACLE") {
              await signEntriesWith(oracleKeypair || platformKeypair);
            }

            if (client.applyAuthEntries) {
              txToSign = client.applyAuthEntries(transaction, authEntries);
            }
          }

          // Ký phong bì giao dịch bằng khóa PLATFORM
          txToSign.sign(platformKeypair);

          // Kiểm tra xem có bật Fee-Bump (CAP-0015, P1) hay không
          let txToSubmit: Transaction | FeeBumpTransaction = txToSign;
          if (isFeeBumpEnabled()) {
            try {
              txToSubmit = buildFeeBumpTx(txToSign, platformKeypair, client.getNetworkPassphrase());
            } catch {
              txToSubmit = txToSign;
            }
          }

          return await client.submitTransaction(txToSubmit);
        });

        if (subRes.status === "FAILED") {
          await updateRecord(head.id, {
            status: "FAILED",
            error: sanitizeError(subRes.error || "Giao dịch bị từ chối khi submit"),
            locked_at: null,
            locked_by: null,
          });
          failed++;
          continue;
        }

        const txHash = subRes.txHash;
        await updateRecord(head.id, { tx_hash: txHash, status: "SUBMITTED" });

        // Poll có giới hạn thời gian phù hợp với serverless
        const pollRes = await client.pollTransaction(txHash, pollTimeout, 1000);
        if (pollRes.status === "SUCCESS") {
          await updateRecord(head.id, { status: "CONFIRMED", error: null, locked_at: null, locked_by: null });
          confirmed++;
        } else if (pollRes.status === "FAILED") {
          await updateRecord(head.id, {
            status: "FAILED",
            error: sanitizeError(pollRes.error || "Giao dịch thất bại trên ledger"),
            locked_at: null,
            locked_by: null,
          });
          failed++;
        } else {
          // Vẫn SUBMITTED khi hết thời gian chờ: nhả lock để background worker tiếp tục đối soát
          await updateRecord(head.id, { locked_at: null, locked_by: null });
        }
      } catch (err) {
        await updateRecord(head.id, {
          status: "FAILED",
          error: sanitizeError(err),
          locked_at: null,
          locked_by: null,
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
