import "./payments-polyfill";
import { describe, expect, it } from "vitest";
import {
  classifyPayment,
  computePaymentRefHash,
  formatPaymentDescription,
  generateOrderCode,
  generatePaymentRefSalt,
  getExpectedPaymentAmount,
} from "@/domain/payments/rules";

describe("classifyPayment (CONTRACTS mục 7)", () => {
  it("xác nhận CONFIRMED khi nộp đủ tiền", () => {
    const result = classifyPayment(BigInt(2000), BigInt(2000));
    expect(result).toEqual({
      status: "CONFIRMED",
      shortfall: BigInt(0),
      excess: BigInt(0),
    });
  });

  it("xác nhận UNDERPAID khi nộp thiếu tiền", () => {
    const result = classifyPayment(BigInt(5000000), BigInt(3000000));
    expect(result).toEqual({
      status: "UNDERPAID",
      shortfall: BigInt(2000000),
      excess: BigInt(0),
    });
  });

  it("xác nhận UNDERPAID khi nộp 0 đồng", () => {
    const result = classifyPayment(BigInt(2000), BigInt(0));
    expect(result).toEqual({
      status: "UNDERPAID",
      shortfall: BigInt(2000),
      excess: BigInt(0),
    });
  });

  it("xác nhận OVERPAID khi nộp thừa tiền", () => {
    const result = classifyPayment(BigInt(2000), BigInt(5000));
    expect(result).toEqual({
      status: "OVERPAID",
      shortfall: BigInt(0),
      excess: BigInt(3000),
    });
  });

  it("ném lỗi khi expected amount là số âm", () => {
    expect(() => classifyPayment(BigInt(-100), BigInt(100))).toThrow(
      "expected amount must not be negative",
    );
  });
});

describe("generateOrderCode", () => {
  it("sinh số nguyên an toàn, dương và duy nhất", () => {
    const codes = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const code = generateOrderCode();
      expect(Number.isSafeInteger(code)).toBe(true);
      expect(code).toBeGreaterThan(0);
      expect(code).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
      codes.add(code);
    }
    expect(codes.size).toBe(100);
  });
});

describe("generatePaymentRefSalt & computePaymentRefHash", () => {
  it("sinh salt 32 bytes hex hợp lệ (64 ký tự)", () => {
    const salt = generatePaymentRefSalt();
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tính hash SHA-256 nhất quán theo CONTRACTS mục 3", () => {
    const salt = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const hash1 = computePaymentRefHash(salt, "PAYOS", 123456);
    const hash2 = computePaymentRefHash(salt, "PAYOS", 123456);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("đổi salt hoặc orderCode cho ra hash khác", () => {
    const salt1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const salt2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
    const hashA = computePaymentRefHash(salt1, "PAYOS", 123);
    const hashB = computePaymentRefHash(salt2, "PAYOS", 123);
    const hashC = computePaymentRefHash(salt1, "PAYOS", 124);

    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});

describe("getExpectedPaymentAmount", () => {
  it("sử dụng DEMO_PAYMENT_AMOUNT khi được cấu hình", () => {
    const expected = getExpectedPaymentAmount(BigInt(5000000), "PAYOS", "2000");
    expect(expected).toBe(BigInt(2000));
  });

  it("fallback sang business_amount khi DEMO_PAYMENT_AMOUNT rỗng", () => {
    const expected = getExpectedPaymentAmount(BigInt(5000000), "SIMULATED", "");
    expect(expected).toBe(BigInt(5000000));
  });
});

describe("formatPaymentDescription", () => {
  it("tạo mô tả ngắn gọn không quá 25 ký tự", () => {
    const descDeposit = formatPaymentDescription("DEPOSIT", 1770000000000000);
    const descRent = formatPaymentDescription("RENT", 1770000000000000);

    expect(descDeposit.startsWith("COC")).toBe(true);
    expect(descRent.startsWith("THUE")).toBe(true);
    expect(descDeposit.length).toBeLessThanOrEqual(25);
    expect(descRent.length).toBeLessThanOrEqual(25);
  });
});
