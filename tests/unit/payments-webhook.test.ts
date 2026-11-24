import "./payments-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPaymentRepository } from "@/domain/payments/repository";
import { processPayOSWebhook } from "@/domain/payments/service";
import * as payosClientModule from "@/lib/payos/client";

describe("payOS Webhook Processing (TASK mục 3 & 4)", () => {
  let repo: InMemoryPaymentRepository;
  const settleMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    repo = new InMemoryPaymentRepository();
    settleMock.mockClear();
  });

  it("xử lý thành công webhook nộp đủ tiền, cập nhật CONFIRMED và gọi settlePayment", async () => {
    await repo.createPayment({
      id: "pay-100",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888001),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const webhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888001,
        amount: 2000,
        description: "COC 888001",
        accountNumber: "12345678",
        reference: "REF_TX_001",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_001",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_sig",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

    const result = await processPayOSWebhook(webhookBody, {
      repo,
      settlePaymentFn: settleMock,
    });

    expect(result.success).toBe(true);
    expect(result.payment?.status).toBe("CONFIRMED");
    expect(result.payment?.paidAmount).toBe("2000");
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), "pay-100");

    const hasEvent = await repo.hasPaymentEvent("PAYOS", "payos_888001_REF_TX_001");
    expect(hasEvent).toBe(true);
  });

  it("xử lý webhook nộp thiếu tiền, cập nhật UNDERPAID và gọi settlePayment", async () => {
    await repo.createPayment({
      id: "pay-101",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888002),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const webhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888002,
        amount: 1000,
        description: "COC 888002",
        accountNumber: "12345678",
        reference: "REF_TX_002",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_002",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_sig",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

    const result = await processPayOSWebhook(webhookBody, {
      repo,
      settlePaymentFn: settleMock,
    });

    expect(result.success).toBe(true);
    expect(result.payment?.status).toBe("UNDERPAID");
    expect(result.payment?.paidAmount).toBe("1000");
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), "pay-101");
  });

  it("xử lý webhook nộp thừa tiền, cập nhật OVERPAID và gọi settlePayment", async () => {
    await repo.createPayment({
      id: "pay-102",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888003),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const webhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888003,
        amount: 5000,
        description: "COC 888003",
        accountNumber: "12345678",
        reference: "REF_TX_003",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_003",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_sig",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

    const result = await processPayOSWebhook(webhookBody, {
      repo,
      settlePaymentFn: settleMock,
    });

    expect(result.success).toBe(true);
    expect(result.payment?.status).toBe("OVERPAID");
    expect(result.payment?.paidAmount).toBe("5000");
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), "pay-102");
  });

  it("idempotent: webhook gửi nhiều lần cùng reference chỉ xử lý một lần, trả về 200", async () => {
    await repo.createPayment({
      id: "pay-103",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888004),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const webhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888004,
        amount: 2000,
        description: "COC 888004",
        accountNumber: "12345678",
        reference: "DUPLICATE_TX_004",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_004",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_sig",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

    const firstResult = await processPayOSWebhook(webhookBody, {
      repo,
      settlePaymentFn: settleMock,
    });
    expect(firstResult.success).toBe(true);
    expect(firstResult.alreadyProcessed).toBeUndefined();
    expect(settleMock).toHaveBeenCalledTimes(1);

    const secondResult = await processPayOSWebhook(webhookBody, {
      repo,
      settlePaymentFn: settleMock,
    });
    expect(secondResult.success).toBe(true);
    expect(secondResult.alreadyProcessed).toBe(true);
    expect(settleMock).toHaveBeenCalledTimes(1);
  });

  it("xử lý đúng webhook test của payOS khi xác nhận endpoint (orderCode 123)", async () => {
    const testWebhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 123,
        amount: 3000,
        description: "VQRIO123",
        accountNumber: "12345678",
        reference: "TF230204212323",
        transactionDateTime: "2023-02-04 18:25:00",
        currency: "VND",
        paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_test_sig",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(testWebhookBody.data);

    const result = await processPayOSWebhook(testWebhookBody, { repo });
    expect(result.success).toBe(true);
    expect(result.isTest).toBe(true);
  });

  it("từ chối khi chữ ký webhook không hợp lệ (trả 400)", async () => {
    const invalidWebhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 999999,
        amount: 2000,
        description: "COC 999999",
        accountNumber: "12345678",
        reference: "REF_INVALID",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_invalid",
        code: "00",
        desc: "Thành công",
      },
      signature: "bad_signature",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockRejectedValue(
      new payosClientModule.WebhookError("Invalid signature"),
    );

    await expect(processPayOSWebhook(invalidWebhookBody, { repo })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("P0 TRUNG THỰC (TASK mục 2): khi settlePayment thất bại, webhook ném lỗi và xóa payment_events để không đánh dấu xong sai, cho phép retry", async () => {
    await repo.createPayment({
      id: "pay-settle-fail",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888005),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const webhookBody = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888005,
        amount: 2000,
        description: "COC 888005",
        accountNumber: "12345678",
        reference: "TX_SETTLE_FAIL",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_fail_005",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_sig",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

    // Lần 1: settlePayment gặp sự cố (ví dụ timeout DB hoặc lock)
    settleMock.mockRejectedValueOnce(new Error("Lỗi kết nối cơ sở dữ liệu khi quyết toán"));

    await expect(
      processPayOSWebhook(webhookBody, {
        repo,
        settlePaymentFn: settleMock,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    // Không được đánh dấu xong sai: event_key đã được xóa khỏi payment_events
    const hasEvent = await repo.hasPaymentEvent("PAYOS", "payos_888005_TX_SETTLE_FAIL");
    expect(hasEvent).toBe(false);

    // Lần 2: payOS retry gửi lại webhook -> settlePayment thành công!
    settleMock.mockResolvedValueOnce(undefined);
    const retryResult = await processPayOSWebhook(webhookBody, {
      repo,
      settlePaymentFn: settleMock,
    });

    expect(retryResult.success).toBe(true);
    expect(retryResult.payment?.status).toBe("CONFIRMED");
    expect(await repo.hasPaymentEvent("PAYOS", "payos_888005_TX_SETTLE_FAIL")).toBe(true);
  });

  it("P0 TRUNG THỰC (TASK mục 4): webhook chữ ký đúng nhưng số tiền lệch không được thành CONFIRMED", async () => {
    // 1. Nộp thiếu: expected 2000, paid 1500 -> UNDERPAID
    await repo.createPayment({
      id: "pay-mismatch-1",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888006),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const underpaidWebhook = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888006,
        amount: 1500, // Lệch số tiền (thiếu 500đ)
        description: "COC 888006",
        accountNumber: "12345678",
        reference: "TX_MISMATCH_UNDER",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_under",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_signature_under",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(underpaidWebhook.data);

    const resultUnder = await processPayOSWebhook(underpaidWebhook, {
      repo,
      settlePaymentFn: settleMock,
    });

    expect(resultUnder.payment?.status).toBe("UNDERPAID");
    expect(resultUnder.payment?.status).not.toBe("CONFIRMED");

    // 2. Nộp thừa: expected 2000, paid 2500 -> OVERPAID
    await repo.createPayment({
      id: "pay-mismatch-2",
      contract_id: "contract-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(888007),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const overpaidWebhook = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 888007,
        amount: 2500, // Lệch số tiền (thừa 500đ)
        description: "COC 888007",
        accountNumber: "12345678",
        reference: "TX_MISMATCH_OVER",
        transactionDateTime: "2026-11-23 21:00:00",
        currency: "VND",
        paymentLinkId: "link_over",
        code: "00",
        desc: "Thành công",
      },
      signature: "valid_signature_over",
    };

    vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(overpaidWebhook.data);

    const resultOver = await processPayOSWebhook(overpaidWebhook, {
      repo,
      settlePaymentFn: settleMock,
    });

    expect(resultOver.payment?.status).toBe("OVERPAID");
    expect(resultOver.payment?.status).not.toBe("CONFIRMED");
  });
});

