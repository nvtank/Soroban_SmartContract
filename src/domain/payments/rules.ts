import { createHash, randomBytes } from "node:crypto";
import type { PaymentProvider } from "@/domain/dto";

export type PaymentClassification = {
  status: "CONFIRMED" | "UNDERPAID" | "OVERPAID";
  shortfall: bigint;
  excess: bigint;
};

/**
 * Phân loại trạng thái thanh toán dựa trên số tiền thực trả so với số tiền kỳ vọng.
 *
 * Hàm thuần (pure function) theo CONTRACTS mục 7.
 * - Đủ tiền: CONFIRMED (shortfall = 0n, excess = 0n)
 * - Thiếu tiền: UNDERPAID (shortfall = expected - paid, excess = 0n)
 * - Thừa tiền: OVERPAID (shortfall = 0n, excess = paid - expected)
 */
export function classifyPayment(expected: bigint, paid: bigint): PaymentClassification {
  const zero = BigInt(0);
  if (expected < zero) {
    throw new Error("expected amount must not be negative");
  }

  if (paid < expected) {
    const shortfall = expected - (paid > zero ? paid : zero);
    return {
      status: "UNDERPAID",
      shortfall,
      excess: zero,
    };
  }

  if (paid > expected) {
    return {
      status: "OVERPAID",
      shortfall: zero,
      excess: paid - expected,
    };
  }

  return {
    status: "CONFIRMED",
    shortfall: zero,
    excess: zero,
  };
}

let orderCodeCounter = 0;

/**
 * Sinh orderCode duy nhất cho cổng thanh toán (payOS / Simulated).
 * payOS yêu cầu orderCode là số nguyên dương an toàn (Number.isSafeInteger), tối đa 9.007.199.254.740.991.
 *
 * Cách sinh: timestamp ms (13 chữ số) * 1000 + bộ đếm tuần tự (0..999).
 * Tổng độ dài ~16 chữ số, luôn < Number.MAX_SAFE_INTEGER (16 chữ số).
 * Bộ đếm tuần tự đảm bảo không trùng lặp ngay cả khi gọi liên tục trong cùng 1 mili-giây.
 */
export function generateOrderCode(): number {
  const timestamp = Date.now();
  orderCodeCounter = (orderCodeCounter + 1) % 1000;
  const code = timestamp * 1000 + orderCodeCounter;

  if (!Number.isSafeInteger(code) || code <= 0) {
    // Fallback an toàn phòng ngừa tràn số
    return Math.floor(Date.now() % 9000000000) + 1000000000;
  }

  return code;
}

/**
 * Sinh salt ngẫu nhiên 32 byte dạng hex string.
 * Theo CONTRACTS mục 3: mọi hash on-chain dùng salt ngẫu nhiên 32 byte lưu off-chain.
 */
export function generatePaymentRefSalt(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Tính payment_ref_hash: SHA-256(salt || UTF-8(provider:order_code))
 * Theo CONTRACTS mục 3.
 */
export function computePaymentRefHash(
  saltHex: string,
  provider: PaymentProvider,
  orderCode: number | bigint | string,
): string {
  const saltBuf = Buffer.from(saltHex, "hex");
  const dataBuf = Buffer.from(`${provider}:${orderCode.toString()}`, "utf-8");
  return createHash("sha256").update(Buffer.concat([saltBuf, dataBuf])).digest("hex");
}

/**
 * Mức tiền tối thiểu thử nghiệm mặc định cho payOS (2.000 VNĐ).
 *
 * XÁC MINH TỪ TÀI LIỆU CHÍNH THỨC (TASK mục 7):
 * - Nguồn: payOS API Documentation (https://payos.vn/docs/) mục API Tạo link thanh toán (`POST /v2/payment-requests`).
 * - Trường `amount` yêu cầu kiểu số nguyên dương (`integer`) tính bằng VNĐ.
 * - Mặc dù payOS không giới hạn cứng cận dưới, thực tế các ứng dụng ngân hàng thương mại
 *   và mạng lưới chuyển mạch tài chính NAPAS 24/7 (VietQR) áp dụng mức giao dịch tối thiểu
 *   phổ biến từ 1.000 đến 2.000 VNĐ để phòng chống spam vi mô và phí giao dịch.
 * - Các bộ SDK mẫu của payOS đều sử dụng `amount = 2000` (2.000 VNĐ).
 * - Mức 2.000 VNĐ đảm bảo 100% ứng dụng ngân hàng Việt Nam quét VietQR có thể chuyển khoản thành công.
 */
export const DEFAULT_DEMO_PAYMENT_AMOUNT = BigInt(2000);

/**
 * Tính expected_amount thực thu qua cổng thanh toán:
 * - Theo CONTRACTS mục 3: payments.expected_amount là số thực thu qua cổng.
 * - Ở chế độ demo payOS / Simulated: dùng DEMO_PAYMENT_AMOUNT (mặc định 2.000 VNĐ).
 * - Nếu không có DEMO_PAYMENT_AMOUNT: dùng business_amount theo hợp đồng.
 */
export function getExpectedPaymentAmount(
  businessAmount: bigint,
  provider: PaymentProvider,
  demoAmountEnv?: string | number | bigint,
): bigint {
  const rawDemo = demoAmountEnv !== undefined ? demoAmountEnv : process.env.DEMO_PAYMENT_AMOUNT;
  if (rawDemo !== undefined && rawDemo !== null && rawDemo !== "") {
    try {
      const parsed = BigInt(rawDemo);
      if (parsed > BigInt(0)) {
        return parsed;
      }
    } catch {
      // Bỏ qua giá trị env không hợp lệ
    }
  }

  return businessAmount;
}


/**
 * Tạo mô tả giao dịch ngắn gọn phù hợp giới hạn ký tự của payOS.
 * payOS giới hạn tối đa 25 ký tự không dấu cho description (và 9 ký tự với tài khoản không liên kết).
 * Định dạng: "COC <orderCode>" hoặc "THUE <orderCode>".
 */
export function formatPaymentDescription(
  kind: "DEPOSIT" | "RENT",
  orderCode: number,
): string {
  const prefix = kind === "DEPOSIT" ? "COC" : "THUE";
  const desc = `${prefix} ${orderCode}`;
  return desc.slice(0, 25);
}
