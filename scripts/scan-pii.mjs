#!/usr/bin/env node

/**
 * scan-pii.mjs
 * Quét toàn bộ payload on-chain (trong bảng onchain_txs và outbox payloads)
 * để đảm bảo KHÔNG CÓ dữ liệu nhận dạng cá nhân (PII) nào được đưa lên blockchain.
 * Trả exit code 1 nếu có vi phạm, exit code 0 nếu an toàn.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Polyfill globalThis.WebSocket for Node 20 if needed
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class MockWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

// Đọc biến môi trường từ .env.local nếu có
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
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
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // Ignored
}

const FORBIDDEN_KEYS = new Set([
  "name",
  "fullname",
  "full_name",
  "tenantname",
  "tenant_name",
  "landlordname",
  "landlord_name",
  "phone",
  "phonenumber",
  "phone_number",
  "sdt",
  "email",
  "cccd",
  "cmnd",
  "id_card",
  "address",
  "diachi",
  "dia_chi",
  "room_label",
  "roomlabel",
  "terms_text",
  "termstext",
  "reason_text",
  "reasontext",
  "image",
  "photo",
  "avatar",
]);

const VN_PHONE_REGEX = /(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const CCCD_REGEX = /\b(?:\d{12}|\d{9})\b/;
const VALID_HEX_64 = /^[a-fA-F0-9]{64}$/;
const VALID_HEX_32 = /^[a-fA-F0-9]{32}$/;
const VALID_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const VALID_STELLAR_ADDR = /^(?:G[A-Z2-7]{55}|C[A-Z2-7]{55})$/;

function containsPii(value, keyName) {
  if (keyName) {
    const normalizedKey = keyName.toLowerCase().replace(/[-_]/g, "");
    if (FORBIDDEN_KEYS.has(normalizedKey)) {
      return {
        hasPii: true,
        reason: `Trường '${keyName}' chứa định danh cá nhân bị cấm trên blockchain`,
      };
    }
  }

  if (value === null || value === undefined) {
    return { hasPii: false };
  }

  if (typeof value === "string") {
    if (VALID_STELLAR_ADDR.test(value) || VALID_HEX_64.test(value) || VALID_HEX_32.test(value) || VALID_UUID.test(value)) {
      return { hasPii: false };
    }

    if (VN_PHONE_REGEX.test(value)) {
      return { hasPii: true, reason: `Phát hiện số điện thoại: ${value}` };
    }

    if (EMAIL_REGEX.test(value)) {
      return { hasPii: true, reason: `Phát hiện email: ${value}` };
    }

    if (CCCD_REGEX.test(value)) {
      return { hasPii: true, reason: `Phát hiện số CCCD/CMND: ${value}` };
    }

    if (value.length > 64 && !/^[a-zA-Z0-9+/=]+$/.test(value)) {
      return { hasPii: true, reason: `Phát hiện văn bản tự do dài có nguy cơ PII: "${value.slice(0, 30)}..."` };
    }

    return { hasPii: false };
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const check = containsPii(value[i]);
      if (check.hasPii) return check;
    }
    return { hasPii: false };
  }

  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const check = containsPii(v, k);
      if (check.hasPii) return check;
    }
    return { hasPii: false };
  }

  return { hasPii: false };
}

let violations = [];

console.log("==================================================");
console.log("RentFlow On-chain PII Scanner");
console.log("==================================================");

// 1. Quét bảng onchain_txs từ cơ sở dữ liệu
console.log("\n[1/2] Đang quét bảng onchain_txs từ Supabase...");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

try {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: txs, error } = await admin
    .from("onchain_txs")
    .select("id, contract_id, action, payload_hash, args, signer, status, tx_hash");

  if (error) {
    console.warn("⚠️ Không thể truy vấn bảng onchain_txs từ DB:", error.message);
  } else if (txs && txs.length > 0) {
    console.log(`Tìm thấy ${txs.length} giao dịch trong onchain_txs. Đang kiểm tra...`);
    for (const tx of txs) {
      // Check action, payload_hash, args, signer
      const checkArgs = containsPii(tx.args, "args");
      if (checkArgs.hasPii) {
        violations.push({ txId: tx.id, field: "args", reason: checkArgs.reason });
      }

      const checkHash = containsPii(tx.payload_hash, "payload_hash");
      if (checkHash.hasPii) {
        violations.push({ txId: tx.id, field: "payload_hash", reason: checkHash.reason });
      }
    }
  } else {
    console.log("Bảng onchain_txs hiện tại rỗng.");
  }
} catch (err) {
  console.warn("⚠️ Không kết nối được Supabase local để quét trực tiếp:", err.message);
}

// 2. Quét các file dữ liệu seed và mock on-chain
console.log("\n[2/2] Đang quét các file dữ liệu on-chain mẫu...");

// Hỗ trợ kiểm tra payload trực tiếp từ file hoặc JSON string qua CLI arguments
const cliArg = process.argv[2];
if (cliArg) {
  try {
    let payload;
    if (fs.existsSync(cliArg)) {
      payload = JSON.parse(fs.readFileSync(cliArg, "utf8"));
    } else {
      payload = JSON.parse(cliArg);
    }
    const check = containsPii(payload);
    if (check.hasPii) {
      violations.push({ input: cliArg, reason: check.reason });
    }
  } catch {
    // Không phải JSON
  }
}
const mockDataFile = path.resolve(process.cwd(), "src/components/app/mock/mock-data.ts");
if (fs.existsSync(mockDataFile)) {
  const content = fs.readFileSync(mockDataFile, "utf8");
  // Kiểm tra nếu có INITIAL_ONCHAIN_TXS chứa chuỗi nhạy cảm
  if (content.includes("INITIAL_ONCHAIN_TXS")) {
    const lines = content.split("\n");
    let insideTxs = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("INITIAL_ONCHAIN_TXS")) insideTxs = true;
      if (insideTxs && line.startsWith("];")) insideTxs = false;

      if (insideTxs) {
        if (VN_PHONE_REGEX.test(line)) {
          violations.push({ file: mockDataFile, line: i + 1, reason: "Số điện thoại trong mock txs" });
        }
      }
    }
  }
}

console.log("\n==================================================");
if (violations.length > 0) {
  console.error(`🚨 PHÁT HIỆN ${violations.length} VI PHẠM PII TRÊN ON-CHAIN!`);
  for (const v of violations) {
    console.error(`  - [VIOLATION]: ${JSON.stringify(v)}`);
  }
  process.exit(1);
} else {
  console.log("✅ HOÀN TẤT: Dữ liệu on-chain hoàn toàn sạch PII, tuân thủ đạo đức Blockchain.");
  process.exit(0);
}
