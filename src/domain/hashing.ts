import { createHash, randomBytes } from "node:crypto";

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

/**
 * Sinh salt ngẫu nhiên 32 byte dạng chuỗi hex (64 ký tự).
 */
export function newSalt(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Băm SHA-256 có salt: SHA-256(salt || data)
 * @param saltHex Chuỗi hex 32 byte
 * @param data Chuỗi UTF-8 hoặc Buffer
 */
export function saltedHash(saltHex: string, data: string | Uint8Array): string {
  const saltBuf = Buffer.from(saltHex, "hex");
  const dataBuf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return createHash("sha256")
    .update(Buffer.concat([saltBuf, dataBuf]))
    .digest("hex");
}

/**
 * Chuẩn hóa nội dung hợp đồng trước khi băm theo CONTRACTS.md mục 3:
 * JSON khóa sắp theo thứ tự byte, không khoảng trắng, chuỗi Unicode NFC, xuống dòng \n,
 * tiền là chuỗi số nguyên, ngày YYYY-MM-DD, mã hóa UTF-8.
 * Các trường: contract_id, room_label, rent_amount, deposit_amount, start_date, end_date, due_day, late_fee_bps_per_day, terms_text.
 */
export function canonicalizeContract(input: CanonicalContractInput): string {
  const normalizeStr = (val: string) => val.normalize("NFC").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const normalized = {
    contract_id: normalizeStr(input.contract_id),
    deposit_amount: String(BigInt(input.deposit_amount)),
    due_day: Number(input.due_day),
    end_date: normalizeStr(input.end_date),
    late_fee_bps_per_day: Number(input.late_fee_bps_per_day),
    rent_amount: String(BigInt(input.rent_amount)),
    room_label: normalizeStr(input.room_label),
    start_date: normalizeStr(input.start_date),
    terms_text: normalizeStr(input.terms_text),
  };

  // Khóa sắp xếp theo thứ tự byte (ASCII code order)
  const sortedKeys = Object.keys(normalized).sort() as (keyof typeof normalized)[];
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = normalized[key];
  }

  return JSON.stringify(sortedObj);
}

/**
 * Tính doc_hash cho hợp đồng: SHA-256(salt || canonical_bytes)
 */
export function hashContract(input: CanonicalContractInput, saltHex: string): string {
  const canonicalJson = canonicalizeContract(input);
  return saltedHash(saltHex, canonicalJson);
}

/**
 * Tính reason_hash cho lý do khấu trừ: SHA-256(salt || UTF-8(reason_text))
 */
export function hashReason(reasonText: string, saltHex: string): string {
  const normalized = reasonText.normalize("NFC").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return saltedHash(saltHex, normalized);
}

/**
 * Tính payment_ref_hash: SHA-256(salt || UTF-8(provider:order_code))
 */
export function hashPaymentRef(provider: string, orderCode: string | bigint, saltHex: string): string {
  const ref = `${provider}:${orderCode}`.normalize("NFC");
  return saltedHash(saltHex, ref);
}
