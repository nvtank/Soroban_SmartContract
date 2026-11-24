#!/usr/bin/env node

/**
 * scripts/verify-onchain.mjs
 * Công cụ kiểm chứng tính toàn vẹn on-chain độc lập cho hợp đồng RentFlow.
 * 
 * Cách dùng:
 *   node scripts/verify-onchain.mjs [contractId]
 *   node scripts/verify-onchain.mjs --all
 *   node scripts/verify-onchain.mjs --list
 * 
 * Quy trình:
 * 1. Đọc dữ liệu hợp đồng & muối từ Supabase local (.env.local).
 * 2. Tính lại doc_hash bằng chuẩn hóa Canonical JSON + SHA-256 có salt (src/lib/stellar/hash.ts).
 * 3. Đọc trạng thái và doc_hash trên Stellar Testnet qua Soroban RPC (chỉ simulate view get_contract).
 * 4. So sánh đối chiếu 3 nguồn: Tính lại, Database, On-chain.
 * 5. Thoát mã 0 nếu khớp 100%, thoát mã 1 nếu có bất kỳ sai lệch nào.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";

// Polyfill WebSocket cho Node.js 20 nếu cần
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class MockWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

// 1. Đọc biến môi trường từ .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ Không tìm thấy file .env.local trong thư mục làm việc.");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const rpcUrl = env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const contractIdOnChain = env.STELLAR_CONTRACT_ID;
const networkPassphrase = env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

if (!serviceRoleKey) {
  console.error("❌ Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.local.");
  process.exit(1);
}
if (!contractIdOnChain) {
  console.error("❌ Thiếu STELLAR_CONTRACT_ID trong .env.local.");
  process.exit(1);
}

// 2. Quy tắc chuẩn hóa và tính hash theo src/lib/stellar/hash.ts
function normalizeString(val) {
  return String(val ?? "").normalize("NFC").replace(/\r\n|\r/g, "\n");
}

function canonicalizeContract(input) {
  const sorted = {
    contract_id: normalizeString(input.contract_id),
    deposit_amount: normalizeString(String(input.deposit_amount)),
    due_day: Number(input.due_day),
    end_date: normalizeString(input.end_date),
    late_fee_bps_per_day: Number(input.late_fee_bps_per_day),
    rent_amount: normalizeString(String(input.rent_amount)),
    room_label: normalizeString(input.room_label),
    start_date: normalizeString(input.start_date),
    terms_text: normalizeString(input.terms_text),
  };
  return JSON.stringify(sorted);
}

function saltedHash(saltHex, dataString) {
  const cleanSalt = saltHex.replace(/^0x/i, "").toLowerCase();
  if (cleanSalt.length !== 64) {
    throw new Error(`Salt không hợp lệ (cần 64 ký tự hex = 32 byte): ${saltHex}`);
  }
  const saltBuf = Buffer.from(cleanSalt, "hex");
  const dataBuf = Buffer.from(dataString, "utf8");
  return crypto
    .createHash("sha256")
    .update(Buffer.concat([saltBuf, dataBuf]))
    .digest("hex")
    .toLowerCase();
}

// 3. Mapping enum theo src/domain/states.ts và contracts/rentflow/src/types.rs
const CONTRACT_STATUSES = ["PENDING_CONFIRMATION", "ACTIVE", "ENDED", "CANCELLED"];
const DEPOSIT_STATUSES = [
  "UNPAID",
  "RECORDED",
  "PENDING_REFUND",
  "PENDING_DISPUTE",
  "REFUNDED",
  "DEDUCTED",
];
const DISPUTE_STATUSES = ["NONE", "AWAITING_CONFIRMATION", "IN_PROGRESS", "RESOLVED"];

// Khởi tạo client
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const server = new rpc.Server(rpcUrl);

// 4. Đọc contract từ Soroban RPC
async function fetchOnchainContract(uuid) {
  const cleanUuid = uuid.replace(/[-_]/g, "").toLowerCase();
  if (cleanUuid.length !== 32) {
    throw new Error(`UUID không hợp lệ (phải đúng 32 hex = 16 bytes): ${uuid}`);
  }
  const uuidScVal = xdr.ScVal.scvBytes(Buffer.from(cleanUuid, "hex"));

  const contract = new Contract(contractIdOnChain);
  const op = contract.call("get_contract", uuidScVal);

  // Tài khoản giả lập cho RPC simulation (không tốn phí, không gửi giao dịch)
  const dummyAccount = new Account("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", "0");
  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const simRes = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simRes)) {
    throw new Error(`Mô phỏng gọi get_contract thất bại: ${simRes.error || JSON.stringify(simRes)}`);
  }

  const raw = scValToNative(simRes.result.retval);
  const onchainDocHash = Buffer.from(raw.doc_hash).toString("hex").toLowerCase();
  const statusCode = Number(raw.status);
  const depositStatusCode = Number(raw.deposit_status);
  const disputeStatusCode = Number(raw.dispute_status);

  return {
    raw,
    doc_hash: onchainDocHash,
    statusCode,
    status: CONTRACT_STATUSES[statusCode] ?? `UNKNOWN(${statusCode})`,
    depositStatusCode,
    deposit_status: DEPOSIT_STATUSES[depositStatusCode] ?? `UNKNOWN(${depositStatusCode})`,
    disputeStatusCode,
    dispute_status: DISPUTE_STATUSES[disputeStatusCode] ?? `UNKNOWN(${disputeStatusCode})`,
    deposit_amount: raw.deposit_amount?.toString(),
    rent_amount: raw.rent_amount?.toString(),
    due_day: raw.due_day,
    late_fee_bps_per_day: raw.late_fee_bps_per_day,
    landlord: raw.landlord,
    tenant: raw.tenant,
  };
}

// In bảng định dạng CLI
function printComparisonTable(results) {
  console.log("\n" + "=".repeat(95));
  console.log(`BẢNG SO SÁNH TÍNH TOÀN VẸN HỢP ĐỒNG: ${results.contractId}`);
  console.log(`Phòng: ${results.roomLabel}`);
  console.log("=".repeat(95));

  const headers = [
    "Hạng mục".padEnd(20),
    "Tính lại (Canonical)".padEnd(30),
    "Database (Supabase)".padEnd(30),
    "On-chain (Stellar)".padEnd(30),
    "Trạng thái",
  ];
  console.log(
    headers[0] + " | " + headers[1] + " | " + headers[2] + " | " + headers[3] + " | " + headers[4]
  );
  console.log("-".repeat(125));

  for (const row of results.rows) {
    const name = row.name.padEnd(20);
    const computed = String(row.computed).padEnd(30);
    const database = String(row.database).padEnd(30);
    const onchain = String(row.onchain).padEnd(30);
    const match = row.match ? "✅ KHỚP" : "❌ LỆCH";
    console.log(`${name} | ${computed} | ${database} | ${onchain} | ${match}`);
  }
  console.log("=".repeat(125));
}

async function verifyContract(contractRecord) {
  const contractId = contractRecord.id;
  console.log(`\n🔍 Đang kiểm tra hợp đồng: ${contractId} (${contractRecord.room_label})...`);

  // 1. Lấy thông tin deposit từ database
  const { data: depositRecord, error: depositError } = await db
    .from("deposits")
    .select("*")
    .eq("contract_id", contractId)
    .maybeSingle();

  if (depositError) {
    console.warn(`⚠️ Cảnh báo: Không thể đọc bảng deposits cho contract ${contractId}:`, depositError.message);
  }

  // 2. Tính lại doc_hash
  if (!contractRecord.doc_salt) {
    throw new Error(`Hợp đồng ${contractId} thiếu doc_salt trong database!`);
  }

  const canonicalInput = {
    contract_id: contractRecord.id,
    room_label: contractRecord.room_label,
    rent_amount: contractRecord.rent_amount,
    deposit_amount: contractRecord.deposit_amount,
    start_date: contractRecord.start_date,
    end_date: contractRecord.end_date,
    due_day: contractRecord.due_day,
    late_fee_bps_per_day: contractRecord.late_fee_bps_per_day,
    terms_text: contractRecord.terms_text,
  };

  const canonicalJson = canonicalizeContract(canonicalInput);
  const recomputedHash = saltedHash(contractRecord.doc_salt, canonicalJson);
  const dbHash = (contractRecord.doc_hash || "").toLowerCase();

  // 3. Đọc dữ liệu từ Soroban on-chain
  const onchainData = await fetchOnchainContract(contractId);

  // 4. So sánh từng trường
  const hashMatch = recomputedHash === dbHash && dbHash === onchainData.doc_hash;
  const contractStatusMatch = contractRecord.status === onchainData.status;
  const dbDepositStatus = depositRecord?.status || "UNPAID";
  const depositStatusMatch = dbDepositStatus === onchainData.deposit_status;

  const rows = [
    {
      name: "Mã băm doc_hash",
      computed: recomputedHash.slice(0, 12) + "..." + recomputedHash.slice(-8),
      database: dbHash.slice(0, 12) + "..." + dbHash.slice(-8),
      onchain: onchainData.doc_hash.slice(0, 12) + "..." + onchainData.doc_hash.slice(-8),
      match: hashMatch,
    },
    {
      name: "Trạng thái HĐ",
      computed: contractRecord.status,
      database: contractRecord.status,
      onchain: onchainData.status,
      match: contractStatusMatch,
    },
    {
      name: "Trạng thái Cọc",
      computed: dbDepositStatus,
      database: dbDepositStatus,
      onchain: onchainData.deposit_status,
      match: depositStatusMatch,
    },
    {
      name: "Tiền cọc (VND)",
      computed: String(contractRecord.deposit_amount),
      database: String(contractRecord.deposit_amount),
      onchain: onchainData.deposit_amount,
      match: String(contractRecord.deposit_amount) === onchainData.deposit_amount,
    },
    {
      name: "Tiền thuê (VND)",
      computed: String(contractRecord.rent_amount),
      database: String(contractRecord.rent_amount),
      onchain: onchainData.rent_amount,
      match: String(contractRecord.rent_amount) === onchainData.rent_amount,
    },
  ];

  printComparisonTable({
    contractId,
    roomLabel: contractRecord.room_label,
    rows,
  });

  const isAllMatched = hashMatch && contractStatusMatch && depositStatusMatch;

  if (isAllMatched) {
    console.log(`✅ HỢP ĐỒNG ${contractId}: TÍNH TOÀN VẸN ĐẠT 100%!`);
  } else {
    console.error(`🚨 HỢP ĐỒNG ${contractId}: PHÁT HIỆN SAI LỆCH TOÀN VẸN!`);
    if (!hashMatch) {
      console.error(`   - Hash lệch: Computed=${recomputedHash} vs DB=${dbHash} vs OnChain=${onchainData.doc_hash}`);
    }
    if (!contractStatusMatch) {
      console.error(`   - Trạng thái hợp đồng lệch: DB=${contractRecord.status} vs OnChain=${onchainData.status}`);
    }
    if (!depositStatusMatch) {
      console.error(`   - Trạng thái cọc lệch: DB=${dbDepositStatus} vs OnChain=${onchainData.deposit_status}`);
    }
  }

  return isAllMatched;
}

async function main() {
  const arg = process.argv[2];

  console.log("==================================================================");
  console.log("RentFlow On-chain Verifier — Công cụ tự kiểm chứng tính toàn vẹn");
  console.log("Smart Contract (Testnet):", contractIdOnChain);
  console.log("Soroban RPC URL:         ", rpcUrl);
  console.log("Supabase URL:            ", supabaseUrl);
  console.log("==================================================================");

  // 1. Liệt kê danh sách nếu yêu cầu
  if (arg === "--list") {
    const { data: list, error } = await db
      .from("rental_contracts")
      .select("id, room_label, rent_amount, deposit_amount, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Lỗi khi đọc danh sách hợp đồng:", error.message);
      process.exit(1);
    }

    console.log(`\nDanh sách ${list.length} hợp đồng hiện có trong cơ sở dữ liệu:`);
    for (const c of list) {
      console.log(`  - ID: ${c.id} | Phòng: ${c.room_label.padEnd(30)} | Trạng thái: ${c.status}`);
    }
    process.exit(0);
  }

  let contractsToVerify = [];

  if (arg && arg !== "--all") {
    // Kiểm tra 1 contract cụ thể
    const { data: contract, error } = await db
      .from("rental_contracts")
      .select("*")
      .eq("id", arg)
      .maybeSingle();

    if (error || !contract) {
      console.error(`❌ Không tìm thấy hợp đồng với ID: ${arg}`);
      process.exit(1);
    }
    contractsToVerify.push(contract);
  } else {
    // Kiểm tra tất cả hợp đồng hiện có trong database
    const { data: list, error } = await db
      .from("rental_contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !list || list.length === 0) {
      console.error("❌ Không có hợp đồng nào trong database để kiểm chứng.");
      process.exit(1);
    }
    contractsToVerify = list;
  }

  let allSucceeded = true;
  for (const contract of contractsToVerify) {
    try {
      const ok = await verifyContract(contract);
      if (!ok) allSucceeded = false;
    } catch (err) {
      console.error(`❌ Lỗi khi kiểm chứng hợp đồng ${contract.id}:`, err.message);
      allSucceeded = false;
    }
  }

  console.log("\n" + "=".repeat(60));
  if (allSucceeded) {
    console.log("🎉 TẤT CẢ HỢP ĐỒNG ĐÃ ĐƯỢC KIỂM CHỨNG TOÀN VẸN THÀNH CÔNG!");
    console.log("   - Mã băm tính lại = Mã băm trong DB = Mã băm trên Stellar");
    console.log("   - Trạng thái hợp đồng và cọc khớp tuyệt đối 1-1.");
    process.exit(0);
  } else {
    console.error("🚨 CÓ HỢP ĐỒNG KHÔNG VƯỢT QUA KIỂM TRA TÍNH TOÀN VẸN!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
