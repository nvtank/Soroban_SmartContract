import "./payments-polyfill";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateTestWebhookSignature,
  getPaymentMode,
  getPayOSClient,
  isPayOSConfigured,
  PayOSNotConfiguredError,
  resetPayOSClientForTesting,
  verifyPayOSWebhook,
  WebhookError,
} from "@/lib/payos/client";

describe("payOS client lazy initialization", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetPayOSClientForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetPayOSClientForTesting();
  });

  it("không ném lỗi khi import module dù thiếu biến môi trường payOS", () => {
    delete process.env.PAYOS_CLIENT_ID;
    delete process.env.PAYOS_API_KEY;
    delete process.env.PAYOS_CHECKSUM_KEY;

    expect(isPayOSConfigured()).toBe(false);
  });

  it("ném PayOSNotConfiguredError khi gọi getPayOSClient mà thiếu key", () => {
    delete process.env.PAYOS_CLIENT_ID;
    delete process.env.PAYOS_API_KEY;
    delete process.env.PAYOS_CHECKSUM_KEY;

    expect(() => getPayOSClient()).toThrow(PayOSNotConfiguredError);
  });

  it("khởi tạo thành công client khi đã cung cấp đủ 3 key", () => {
    process.env.PAYOS_CLIENT_ID = "mock_client_id";
    process.env.PAYOS_API_KEY = "mock_api_key";
    process.env.PAYOS_CHECKSUM_KEY = "mock_checksum_key";

    expect(isPayOSConfigured()).toBe(true);
    const client = getPayOSClient();
    expect(client).toBeDefined();
    expect(client.clientId).toBe("mock_client_id");
  });

  it("getPaymentMode đọc chính xác PAYMENT_MODE và mặc định là both", () => {
    delete process.env.PAYMENT_MODE;
    expect(getPaymentMode()).toBe("both");

    process.env.PAYMENT_MODE = "payos";
    expect(getPaymentMode()).toBe("payos");

    process.env.PAYMENT_MODE = "simulated";
    expect(getPaymentMode()).toBe("simulated");

    process.env.PAYMENT_MODE = "invalid_mode";
    expect(getPaymentMode()).toBe("both");
  });
});

describe("payOS webhook signature verification", () => {
  const originalEnv = { ...process.env };
  const testChecksumKey = "d010bb1b56956f4d22168ec2826a54f9a08e16ea7be3ffdb837d7a36de9b8e96";

  beforeEach(() => {
    process.env.PAYOS_CLIENT_ID = "test_client_id";
    process.env.PAYOS_API_KEY = "test_api_key";
    process.env.PAYOS_CHECKSUM_KEY = testChecksumKey;
    resetPayOSClientForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetPayOSClientForTesting();
  });

  it("xác thực thành công webhook với chữ ký tự tạo đúng thuật toán SDK", async () => {
    const data = {
      orderCode: 123456,
      amount: 2000,
      description: "COC 123456",
      accountNumber: "12345678",
      reference: "REF123456",
      transactionDateTime: "2026-11-23 20:00:00",
      currency: "VND",
      paymentLinkId: "link_123456",
      code: "00",
      desc: "Thành công",
    };

    const signature = await generateTestWebhookSignature(data, testChecksumKey);
    expect(signature).toBeDefined();

    const verified = await verifyPayOSWebhook({
      code: "00",
      desc: "success",
      success: true,
      data,
      signature,
    });

    expect(verified.orderCode).toBe(123456);
    expect(verified.amount).toBe(2000);
  });

  it("từ chối và ném WebhookError khi chữ ký bị sai lệch", async () => {
    const data = {
      orderCode: 123456,
      amount: 2000,
      description: "COC 123456",
      accountNumber: "12345678",
      reference: "REF123456",
      transactionDateTime: "2026-11-23 20:00:00",
      currency: "VND",
      paymentLinkId: "link_123456",
      code: "00",
      desc: "Thành công",
    };

    const invalidSignature = "0000000000000000000000000000000000000000000000000000000000000000";

    await expect(
      verifyPayOSWebhook({
        code: "00",
        desc: "success",
        success: true,
        data,
        signature: invalidSignature,
      }),
    ).rejects.toThrow(WebhookError);
  });

  it("từ chối khi dữ liệu trong body bị can thiệp sau khi ký (data integrity)", async () => {
    const originalData = {
      orderCode: 123456,
      amount: 2000,
      description: "COC 123456",
      accountNumber: "12345678",
      reference: "REF123456",
      transactionDateTime: "2026-11-23 20:00:00",
      currency: "VND",
      paymentLinkId: "link_123456",
      code: "00",
      desc: "Thành công",
    };

    const signature = await generateTestWebhookSignature(originalData, testChecksumKey);

    // Kẻ tấn công thay đổi số tiền từ 2.000 thành 5.000.000 mà không có checksumKey
    const tamperedData = {
      ...originalData,
      amount: 5000000,
    };

    await expect(
      verifyPayOSWebhook({
        code: "00",
        desc: "success",
        success: true,
        data: tamperedData,
        signature,
      }),
    ).rejects.toThrow(WebhookError);
  });
});
