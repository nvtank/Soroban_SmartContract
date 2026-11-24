import crypto from "node:crypto";
import type { CanonicalContractInput } from "./types";

/**
 * Tạo salt ngẫu nhiên 32 byte dạng chuỗi hex (64 ký tự thường).
 */
export function newSalt(): string {
  return crypto.randomBytes(32).toString("hex").toLowerCase();
}

/**
 * Chuẩn hóa xâu ký tự: Unicode NFC và đổi tất cả dạng xuống dòng (CRLF, CR) thành LF ('\n').
 */
function normalizeString(val: string): string {
  return val.normalize("NFC").replace(/\r\n|\r/g, "\n");
}

/**
 * Chuẩn hóa nội dung hợp đồng trước khi băm theo docs/CONTRACTS.md mục 3:
 * - JSON khóa sắp theo thứ tự byte (ASCII sort)
 * - Không khoảng trắng giữa các token
 * - Chuỗi Unicode NFC
 * - Xuống dòng '\n'
 * - Tiền là chuỗi số nguyên
 * - Ngày YYYY-MM-DD
 * - Mã hóa UTF-8
 *
 * Các trường: contract_id, room_label, rent_amount, deposit_amount, start_date, end_date, due_day, late_fee_bps_per_day, terms_text
 */
export function canonicalizeContract(input: CanonicalContractInput): string {
  // Sắp xếp thứ tự byte các khóa bắt buộc:
  // 1. contract_id
  // 2. deposit_amount
  // 3. due_day
  // 4. end_date
  // 5. late_fee_bps_per_day
  // 6. rent_amount
  // 7. room_label
  // 8. start_date
  // 9. terms_text
  const sorted: Record<string, string | number> = {
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

/**
 * Băm SHA-256 có salt: SHA-256(saltBytes || dataBytes).
 * @param saltHex Chuỗi hex 32 byte (64 ký tự hex)
 * @param data Dữ liệu cần băm (dạng string UTF-8 hoặc Uint8Array)
 * @returns 64 ký tự hex chữ thường
 */
export function saltedHash(saltHex: string, data: string | Uint8Array): string {
  const cleanSalt = saltHex.replace(/^0x/i, "").toLowerCase();
  if (cleanSalt.length !== 64) {
    throw new Error(`Invalid salt length: expected 64 hex characters (32 bytes), got ${cleanSalt.length}`);
  }
  const saltBuf = Buffer.from(cleanSalt, "hex");
  const dataBuf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);

  return crypto
    .createHash("sha256")
    .update(Buffer.concat([saltBuf, dataBuf]))
    .digest("hex")
    .toLowerCase();
}

/**
 * Tiện ích băm tài liệu hợp đồng: doc_hash = SHA-256(salt || canonical_bytes)
 */
export function hashDoc(saltHex: string, canonicalString: string): string {
  return saltedHash(saltHex, canonicalString);
}

/**
 * Tiện ích băm lý do khấu trừ: reason_hash = SHA-256(salt || reasonText_NFC_LF)
 */
export function hashReason(saltHex: string, reasonText: string): string {
  return saltedHash(saltHex, normalizeString(reasonText));
}

/**
 * Tiện ích băm tham chiếu thanh toán: payment_ref_hash = SHA-256(salt || UTF-8(provider:order_code))
 */
export function hashPaymentRef(
  saltHex: string,
  provider: string,
  orderCode: string | number | bigint,
): string {
  return saltedHash(saltHex, `${provider}:${orderCode}`);
}
