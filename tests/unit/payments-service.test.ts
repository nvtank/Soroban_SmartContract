import "./payments-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPaymentRepository } from "@/domain/payments/repository";
import {
  createDepositPayment,
  createRentPayment,
  getPaymentById,
  recheckPayment,
} from "@/domain/payments/service";
import { ApiError } from "@/lib/api/http";
import * as payosClientModule from "@/lib/payos/client";

describe("Payment Service - createDepositPayment & createRentPayment", () => {
  let repo: InMemoryPaymentRepository;

  beforeEach(() => {
    repo = new InMemoryPaymentRepository();
    repo.contracts.set("contract-1", {
      id: "contract-1",
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      room_label: "Phòng 101",
      rent_amount: BigInt(4000000),
      deposit_amount: BigInt(5000000),
      status: "ACTIVE",
    });
    repo.deposits.set("contract-1", {
      contract_id: "contract-1",
      status: "UNPAID",
      paid_amount: BigInt(0),
    });
    repo.rentPeriods.set("contract-1:1", {
      contract_id: "contract-1",
      period_no: 1,
      amount_due: BigInt(4000000),
      amount_paid: BigInt(0),
      late_days: 2,
      late_fee: BigInt(80000),
      status: "OVERDUE",
    });
  });

  it("tạo thanh toán cọc thành công với business_amount và expected_amount tách biệt", async () => {
    process.env.DEMO_PAYMENT_AMOUNT = "2000";
    process.env.PAYMENT_MODE = "simulated";

    const payment = await createDepositPayment(
      {
        contractId: "contract-1",
        user: { id: "tenant-1", role: "TENANT", fullName: "Nguyễn Văn A", phone: "0901234567" },
        provider: "SIMULATED",
      },
      { repo },
    );

    expect(payment.id).toBeDefined();
    expect(payment.contractId).toBe("contract-1");
    expect(payment.kind).toBe("DEPOSIT");
    expect(payment.businessAmount).toBe("5000000");
    expect(payment.expectedAmount).toBe("2000");
    expect(payment.paidAmount).toBe("0");
    expect(payment.status).toBe("PENDING");
    expect(payment.isSimulated).toBe(true);
    expect(payment.qrData).toContain("MOCK_VIETQR:DEPOSIT:");
  });

  it("từ chối tạo thanh toán cọc khi hợp đồng không tồn tại", async () => {
    await expect(
      createDepositPayment(
        {
          contractId: "non-existent",
          provider: "SIMULATED",
        },
        { repo },
      ),
    ).rejects.toThrow(ApiError);
  });

  it("từ chối người dùng không liên quan đến hợp đồng", async () => {
    await expect(
      createDepositPayment(
        {
          contractId: "contract-1",
          user: { id: "stranger-user", role: "TENANT", fullName: "Người lạ", phone: "0999999999" },
          provider: "SIMULATED",
        },
        { repo },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("từ chối tạo thanh toán cọc khi hợp đồng đã bị hủy", async () => {
    repo.contracts.set("contract-cancelled", {
      id: "contract-cancelled",
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      room_label: "Phòng 102",
      rent_amount: BigInt(3000000),
      deposit_amount: BigInt(3000000),
      status: "CANCELLED",
    });

    await expect(
      createDepositPayment(
        {
          contractId: "contract-cancelled",
          provider: "SIMULATED",
        },
        { repo },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("tạo thanh toán tiền thuê thành công, tính gộp nợ gốc và phí trễ vào business_amount", async () => {
    process.env.DEMO_PAYMENT_AMOUNT = "2000";

    const payment = await createRentPayment(
      {
        contractId: "contract-1",
        periodNo: 1,
        provider: "SIMULATED",
      },
      { repo },
    );

    expect(payment.kind).toBe("RENT");
    expect(payment.periodNo).toBe(1);
    expect(payment.businessAmount).toBe("4080000");
    expect(payment.expectedAmount).toBe("2000");
    expect(payment.status).toBe("PENDING");
  });

  it("từ chối tạo thanh toán tiền thuê khi kỳ thuê đã thanh toán đủ", async () => {
    repo.rentPeriods.set("contract-1:2", {
      contract_id: "contract-1",
      period_no: 2,
      amount_due: BigInt(4000000),
      amount_paid: BigInt(4000000),
      late_days: 0,
      late_fee: BigInt(0),
      status: "PAID",
    });

    await expect(
      createRentPayment(
        {
          contractId: "contract-1",
          periodNo: 2,
          provider: "SIMULATED",
        },
        { repo },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("Payment Service - recheckPayment (Đối soát payOS)", () => {
  let repo: InMemoryPaymentRepository;
  const settleMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    repo = new InMemoryPaymentRepository();
    settleMock.mockClear();
  });

  it("không gọi cổng payOS nếu payment đã CONFIRMED", async () => {
    const payment = await repo.createPayment({
      id: "pay-1",
      contract_id: "c-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(2000),
      provider: "PAYOS",
      order_code: BigInt(999001),
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    const result = await recheckPayment(payment.id, { repo, settlePaymentFn: settleMock });
    expect(result.status).toBe("CONFIRMED");
    expect(settleMock).not.toHaveBeenCalled();
  });

  it("cập nhật CONFIRMED và gọi settlePayment khi payOS trả về PAID", async () => {
    const payment = await repo.createPayment({
      id: "pay-pending",
      contract_id: "c-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(999002),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    vi.spyOn(payosClientModule, "isPayOSConfigured").mockReturnValue(true);
    vi.spyOn(payosClientModule, "getPayOSClient").mockReturnValue({
      paymentRequests: {
        get: vi.fn().mockResolvedValue({
          orderCode: 999002,
          amountPaid: 2000,
          status: "PAID",
        }),
      },
    } as any);

    const result = await recheckPayment(payment.id, { repo, settlePaymentFn: settleMock });
    expect(result.status).toBe("CONFIRMED");
    expect(result.paidAmount).toBe("2000");
    expect(settleMock).toHaveBeenCalledWith(expect.anything(), payment.id);
  });

  it("cập nhật UNDERPAID khi payOS trả về nộp thiếu", async () => {
    const payment = await repo.createPayment({
      id: "pay-under",
      contract_id: "c-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(999003),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    vi.spyOn(payosClientModule, "isPayOSConfigured").mockReturnValue(true);
    vi.spyOn(payosClientModule, "getPayOSClient").mockReturnValue({
      paymentRequests: {
        get: vi.fn().mockResolvedValue({
          orderCode: 999003,
          amountPaid: 1000,
          status: "UNDERPAID",
        }),
      },
    } as any);

    const result = await recheckPayment(payment.id, { repo, settlePaymentFn: settleMock });
    expect(result.status).toBe("UNDERPAID");
    expect(result.paidAmount).toBe("1000");
  });

  it("cập nhật FAILED khi payOS trả về CANCELLED", async () => {
    const payment = await repo.createPayment({
      id: "pay-fail",
      contract_id: "c-1",
      kind: "DEPOSIT",
      period_no: null,
      business_amount: BigInt(5000000),
      expected_amount: BigInt(2000),
      paid_amount: BigInt(0),
      provider: "PAYOS",
      order_code: BigInt(999004),
      status: "PENDING",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      payment_ref_salt: "salt",
    });

    vi.spyOn(payosClientModule, "isPayOSConfigured").mockReturnValue(true);
    vi.spyOn(payosClientModule, "getPayOSClient").mockReturnValue({
      paymentRequests: {
        get: vi.fn().mockResolvedValue({
          orderCode: 999004,
          amountPaid: 0,
          status: "CANCELLED",
        }),
      },
    } as any);

    const result = await recheckPayment(payment.id, { repo, settlePaymentFn: settleMock });
    expect(result.status).toBe("FAILED");
  });
});
