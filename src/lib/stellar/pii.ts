import { ApiError } from "@/lib/api/http";

// Các khóa bị cấm xuất hiện trong payload on-chain
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

// Định dạng số điện thoại Việt Nam (0x... hoặc +84...)
const VN_PHONE_REGEX = /(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b/;

// Định dạng Email
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Định dạng CCCD (12 chữ số) hoặc CMND (9 chữ số) đứng độc lập
const CCCD_REGEX = /\b(?:\d{12}|\d{9})\b/;

// Định dạng hợp lệ trên on-chain: Hex 32 byte (64 ký tự), Hex 16 byte (32 ký tự), hoặc khóa công khai Stellar
const VALID_HEX_64 = /^[a-fA-F0-9]{64}$/;
const VALID_HEX_32 = /^[a-fA-F0-9]{32}$/;
const VALID_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const VALID_STELLAR_ADDR = /^(?:G[A-Z2-7]{55}|C[A-Z2-7]{55})$/;

/**
 * Kiểm tra xem một đối tượng hoặc giá trị có chứa dấu hiệu PII (Personal Identifiable Information) không.
 */
export function containsPii(value: unknown, keyName?: string): { hasPii: boolean; reason?: string } {
  if (keyName) {
    const normalizedKey = keyName.toLowerCase().replace(/[-_]/g, "");
    if (FORBIDDEN_KEYS.has(normalizedKey)) {
      return {
        hasPii: true,
        reason: `Trường '${keyName}' là dữ liệu cá nhân bị cấm đưa lên on-chain`,
      };
    }
  }

  if (value === null || value === undefined) {
    return { hasPii: false };
  }

  if (typeof value === "string") {
    // Cho phép địa chỉ Stellar hợp lệ
    if (VALID_STELLAR_ADDR.test(value)) {
      return { hasPii: false };
    }

    // Cho phép hash hex và UUID hợp lệ
    if (VALID_HEX_64.test(value) || VALID_HEX_32.test(value) || VALID_UUID.test(value)) {
      return { hasPii: false };
    }

    // Kiểm tra số điện thoại
    if (VN_PHONE_REGEX.test(value)) {
      return { hasPii: true, reason: "Phát hiện số điện thoại trong payload" };
    }

    // Kiểm tra Email
    if (EMAIL_REGEX.test(value)) {
      return { hasPii: true, reason: "Phát hiện địa chỉ email trong payload" };
    }

    // Kiểm tra CCCD/CMND
    if (CCCD_REGEX.test(value)) {
      return { hasPii: true, reason: "Phát hiện số CCCD/CMND trong payload" };
    }

    // Không cho phép văn bản tự do dài (vượt quá 64 ký tự mà không phải hash/base64 chuẩn)
    if (value.length > 64 && !/^[a-zA-Z0-9+/=]+$/.test(value)) {
      return {
        hasPii: true,
        reason: "Phát hiện đoạn văn bản dài có thể chứa thông tin cá nhân",
      };
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

/**
 * Ném ngoại lệ ApiError("VALIDATION_ERROR") nếu payload có PII.
 */
/**
 * Vị trí tham số là SỐ (i128 số tiền, u32, u64) của từng hàm contract, ở dạng tham số nghiệp vụ
 * lúc đưa vào hàng đợi (trước khi chèn địa chỉ ví, xem resolve-args.ts). Ví dụ create_contract
 * nghiệp vụ = [id, doc_hash, deposit, rent, due_day, late_fee_bps] nên số ở vị trí 2..5.
 * Số tiền 9 hoặc 12 chữ số (100 triệu đến dưới 1 tỷ, hoặc từ 100 tỷ) trông giống CMND/CCCD;
 * chỉ ở các vị trí này và chỉ khi toàn chữ số thì mới không áp luật CCCD và số điện thoại.
 */
export const NUMERIC_ARG_POSITIONS: Readonly<Record<string, readonly number[]>> = {
  create_contract: [2, 3, 4, 5],
  record_deposit_paid: [2],
  record_rent_paid: [1, 2],
  mark_overdue: [1, 2],
  calc_late_fee: [1, 2],
  extend_due: [1, 2],
  approve_refund: [1],
  propose_deduction: [1],
  resolve_dispute: [1],
};

/** Tên khóa số khi tham số truyền dạng object. */
const NUMERIC_ARG_KEYS = new Set([
  "deposit",
  "rent",
  "amount",
  "refundamount",
  "agreedamount",
  "dueday",
  "latefeebps",
  "latefeebpsperday",
  "period",
  "dayslate",
  "newduets",
]);

const DIGITS_ONLY = /^\d+$/;

/** Bỏ các tham số số (đúng vị trí, toàn chữ số) ra khỏi payload trước khi quét dữ liệu cá nhân. */
function withoutNumericArgs(payload: unknown, action?: string): unknown {
  if (!action) return payload;
  if (Array.isArray(payload)) {
    const positions = NUMERIC_ARG_POSITIONS[action] ?? [];
    return payload.filter(
      (v, i) =>
        !(positions.includes(i) && (typeof v === "number" || (typeof v === "string" && DIGITS_ONLY.test(v)))),
    );
  }
  if (payload && typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).filter(
        ([k, v]) =>
          !(
            NUMERIC_ARG_KEYS.has(k.toLowerCase().replace(/[_-]/g, "")) &&
            (typeof v === "number" || (typeof v === "string" && DIGITS_ONLY.test(v)))
          ),
      ),
    );
  }
  return payload;
}

export function assertNoPii(payload: unknown, context?: string): void {
  // context là tên hàm contract khi gọi từ hàng đợi on-chain
  const result = containsPii(withoutNumericArgs(payload, context));
  if (result.hasPii) {
    const ctxMsg = context ? ` [${context}]` : "";
    throw new ApiError(
      "VALIDATION_ERROR",
      { reason: result.reason },
      `Dữ liệu on-chain vi phạm quy tắc bảo mật riêng tư${ctxMsg}: ${result.reason}`,
    );
  }
}

/**
 * Làm sạch chuỗi thông báo lỗi trước khi lưu vào DB hoặc trả về API:
 * - Xóa secret keys Stellar (S...)
 * - Xóa chuỗi kết nối, token, master key
 * - Chuẩn hóa mã lỗi Soroban
 */
export function sanitizeError(error: unknown): string {
  if (!error) return "Lỗi không xác định";

  let raw = "";
  if (typeof error === "string") {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  } else {
    raw = JSON.stringify(error);
  }

  // Xóa private keys Stellar
  raw = raw.replace(/S[A-Z2-7]{55}/g, "[REDACTED_SECRET]");
  // Xóa hex dài có thể là secret/key
  raw = raw.replace(/\b[0-9a-fA-F]{64}\b/g, "[HASH]");

  // Ánh xạ lỗi Soroban theo contracts/rentflow/src/types.rs (1 đến 18)
  if (raw.includes("AlreadyInitialized") || raw.includes("Error(Contract, #1)")) {
    return "Hợp đồng đã được khởi tạo trên blockchain.";
  }
  if (raw.includes("NotInitialized") || raw.includes("Error(Contract, #2)")) {
    return "Hợp đồng chưa được khởi tạo trên blockchain.";
  }
  if (raw.includes("Unauthorized") || raw.includes("Error(Contract, #3)")) {
    return "Tài khoản không có quyền thực hiện giao dịch này trên blockchain.";
  }
  if (raw.includes("ContractExists") || raw.includes("Error(Contract, #4)")) {
    return "Hợp đồng đã tồn tại trên blockchain.";
  }
  if (raw.includes("ContractNotFound") || raw.includes("Error(Contract, #5)")) {
    return "Không tìm thấy thông tin hợp đồng trên blockchain.";
  }
  if (raw.includes("PeriodNotFound") || raw.includes("Error(Contract, #6)")) {
    return "Không tìm thấy kỳ thuê trên blockchain.";
  }
  if (raw.includes("InvalidTransition") || raw.includes("Error(Contract, #7)")) {
    return "Trạng thái hợp đồng trên blockchain không cho phép thao tác này.";
  }
  if (raw.includes("InvalidAmount") || raw.includes("Error(Contract, #8)")) {
    return "Số tiền không hợp lệ trên blockchain.";
  }
  if (raw.includes("DepositMismatch") || raw.includes("Error(Contract, #9)")) {
    return "Số tiền nạp cọc không khớp với số tiền đã thỏa thuận.";
  }
  if (raw.includes("DeductionExceedsDeposit") || raw.includes("Error(Contract, #10)")) {
    return "Số tiền khấu trừ vượt quá số tiền cọc hiện có.";
  }
  if (raw.includes("DeductionNotFound") || raw.includes("Error(Contract, #11)")) {
    return "Không tìm thấy đề xuất khấu trừ trên blockchain.";
  }
  if (raw.includes("RefundAmountMismatch") || raw.includes("Error(Contract, #12)")) {
    return "Số tiền hoàn cọc của hai bên chưa thống nhất.";
  }
  if (raw.includes("DisputeActive") || raw.includes("Error(Contract, #13)")) {
    return "Hợp đồng đang có tranh chấp trên blockchain, các thao tác giải ngân bị khóa.";
  }
  if (raw.includes("DisputeAmountMismatch") || raw.includes("Error(Contract, #14)")) {
    return "Số tiền giải quyết tranh chấp của hai bên không khớp.";
  }
  if (raw.includes("InvalidDueDay") || raw.includes("Error(Contract, #15)")) {
    return "Ngày thanh toán hàng tháng không hợp lệ (phải từ 1 đến 31).";
  }
  if (raw.includes("Overflow") || raw.includes("Error(Contract, #16)")) {
    return "Lỗi tràn số khi tính toán trên blockchain.";
  }
  if (raw.includes("DuplicatePaymentRef") || raw.includes("Error(Contract, #17)")) {
    return "Mã tham chiếu thanh toán đã được ghi nhận trước đó trên blockchain.";
  }
  if (raw.includes("SamePartyNotAllowed") || raw.includes("Error(Contract, #18)")) {
    return "Chủ nhà và người thuê không được là cùng một tài khoản.";
  }

  // Cắt ngắn nếu thông báo quá dài
  if (raw.length > 250) {
    raw = raw.slice(0, 247) + "…";
  }

  return raw;
}
