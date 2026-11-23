import "./payments-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPaymentRepository } from "@/domain/payments/repository";
import {
  simulatePaymentConfirm,
  simulatePaymentFail,
} from "@/domain/payments/service";
import { ApiError } from "@/lib/api/http";

describe("Payment Simulate Mode (TASK mục 5)", () => {
  let repo: InMemoryPaymentRepository;
  const settleMock = vi.fn().mockResolvedValue(undefined);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    repo = new InMemoryPaymentRepository();
    settleMock.mockClear();

    repo.contracts.set("c-100", {
      id: "c-100",
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      room_label: "Phòng 202",
      rent_amount: BigInt(5000000),
      deposit_amount: BigInt(5000000),
      status: "ACTIVE",
    });

    process.env.PAYMENT_MODE = "both";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("từ chối simulate khi PAYMENT_MODE là payos", async () => {
    process.env.PAYMENT_MODE = "payos";

    const payment = await repo.createPayment({
      id: "pay-sim-1",
      contract_id: "c-100",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "SIMULATED",
      order_code: BigInt(777001),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: true,
      payment_ref_salt: "salt",
    });

    await expect(
      simulatePaymentConfirm(
        { paymentId: payment.id, scenario: "FULL" },
        { repo, settlePaymentFn: settleMock },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      simulatePaymentFail(
        { paymentId: payment.id },
        { repo },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("kiểm tra quyền: chặn người dùng không thuộc hợp đồng can thiệp", async () => {
    const payment = await repo.createPayment({
      id: "pay-sim-2",
      contract_id: "c-100",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "SIMULATED",
      order_code: BigInt(777002),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: true,
      payment_ref_salt: "salt",
    });

    await expect(
      simulatePaymentConfirm(
        {
          paymentId: payment.id,
          user: { id: "stranger-user", role: "TENANT", fullName: "Kẻ lạ", phone: "0999" },
          scenario: "FULL",
        },
        { repo, settlePaymentFn: settleMock },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hỗ trợ tình huống đủ (FULL): luôn is_simulated=true, cập nhật CONFIRMED, gọi settlePayment", async () => {
    const payment = await repo.createPayment({
      id: "pay-sim-full",
      contract_id: "c-100",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "SIMULATED",
      order_code: BigInt(777003),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const result = await simulatePaymentConfirm(
      {
        paymentId: payment.id,
        user: { id: "tenant-1", role: "TENANT", fullName: "Nguyễn Văn A", phone: "0901" },
        scenario: "FULL",
      },
      { repo, settlePaymentFn: settleMock },
    );

    expect(result.status).toBe("CONFIRMED");
    expect(result.paidAmount).toBe("2000");
    expect(result.isSimulated).toBe(true);
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), payment.id);
  });

  it("hỗ trợ tình huống nộp thiếu (UNDERPAID): cập nhật UNDERPAID, gọi settlePayment", async () => {
    const payment = await repo.createPayment({
      id: "pay-sim-under",
      contract_id: "c-100",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "SIMULATED",
      order_code: BigInt(777004),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const result = await simulatePaymentConfirm(
      {
        paymentId: payment.id,
        user: { id: "tenant-1", role: "TENANT", fullName: "Nguyễn Văn A", phone: "0901" },
        scenario: "UNDERPAID",
      },
      { repo, settlePaymentFn: settleMock },
    );

    expect(result.status).toBe("UNDERPAID");
    expect(BigInt(result.paidAmount)).toBeLessThan(BigInt(2000));
    expect(result.isSimulated).toBe(true);
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), payment.id);
  });

  it("hỗ trợ tình huống nộp thừa (OVERPAID): cập nhật OVERPAID, gọi settlePayment", async () => {
    const payment = await repo.createPayment({
      id: "pay-sim-over",
      contract_id: "c-100",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "SIMULATED",
      order_code: BigInt(777005),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const result = await simulatePaymentConfirm(
      {
        paymentId: payment.id,
        user: { id: "tenant-1", role: "TENANT", fullName: "Nguyễn Văn A", phone: "0901" },
        scenario: "OVERPAID",
      },
      { repo, settlePaymentFn: settleMock },
    );

    expect(result.status).toBe("OVERPAID");
    expect(BigInt(result.paidAmount)).toBeGreaterThan(BigInt(2000));
    expect(result.isSimulated).toBe(true);
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), payment.id);
  });

  it("hỗ trợ tình huống thất bại (FAILED): cập nhật FAILED, KHÔNG gọi settlePayment", async () => {
    const payment = await repo.createPayment({
      id: "pay-sim-fail",
      contract_id: "c-100",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "SIMULATED",
      order_code: BigInt(777006),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const result = await simulatePaymentFail(
      {
        paymentId: payment.id,
        user: { id: "landlord-1", role: "LANDLORD", fullName: "Chủ nhà", phone: "0902" },
        reason: "Tài khoản không đủ số dư",
      },
      { repo },
    );

    expect(result.status).toBe("FAILED");
    expect(result.isSimulated).toBe(true);
    expect(settleMock).not.toHaveBeenCalled();
  });
});
