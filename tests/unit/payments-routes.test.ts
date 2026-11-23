import "./payments-polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as depositPayPost } from "@/app/api/contracts/[id]/deposit/pay/route";
import { POST as rentPayPost } from "@/app/api/contracts/[id]/rent/[period]/pay/route";
import { POST as webhookPost } from "@/app/api/payments/payos/webhook/route";
import { POST as simulateConfirmPost } from "@/app/api/payments/[id]/simulate-confirm/route";
import { POST as simulateFailPost } from "@/app/api/payments/[id]/simulate-fail/route";
import { POST as recheckPost } from "@/app/api/payments/[id]/recheck/route";
import { GET as paymentGet } from "@/app/api/payments/[id]/route";
import * as serviceModule from "@/domain/payments/service";

describe("Payments API Route Handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/contracts/[id]/deposit/pay - tạo thanh toán cọc thành công", async () => {
    vi.spyOn(serviceModule, "createDepositPayment").mockResolvedValue({
      id: "pay-deposit-1",
      contractId: "contract-123",
      kind: "DEPOSIT",
      periodNo: null,
      businessAmount: "5000000",
      expectedAmount: "2000",
      paidAmount: "0",
      provider: "SIMULATED",
      status: "PENDING",
      isSimulated: true,
      qrData: "mock_qr",
      checkoutUrl: null,
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/deposit/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "user-1",
      },
      body: JSON.stringify({ provider: "SIMULATED" }),
    });

    const response = await depositPayPost(request, {
      params: Promise.resolve({ id: "contract-123" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBe("pay-deposit-1");
    expect(body.data.kind).toBe("DEPOSIT");
    expect(body.data.status).toBe("PENDING");
  });

  it("POST /api/contracts/[id]/rent/[period]/pay - tạo thanh toán tiền thuê thành công", async () => {
    vi.spyOn(serviceModule, "createRentPayment").mockResolvedValue({
      id: "pay-rent-1",
      contractId: "contract-123",
      kind: "RENT",
      periodNo: 2,
      businessAmount: "4000000",
      expectedAmount: "2000",
      paidAmount: "0",
      provider: "SIMULATED",
      status: "PENDING",
      isSimulated: true,
      qrData: "mock_qr",
      checkoutUrl: null,
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/rent/2/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await rentPayPost(request, {
      params: Promise.resolve({ id: "contract-123", period: "2" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBe("pay-rent-1");
    expect(body.data.periodNo).toBe(2);
  });

  it("POST /api/contracts/[id]/rent/[period]/pay - từ chối khi số kỳ thuê không hợp lệ", async () => {
    const request = new Request("http://localhost:3000/api/contracts/contract-123/rent/invalid/pay", {
      method: "POST",
    });

    const response = await rentPayPost(request, {
      params: Promise.resolve({ id: "contract-123", period: "invalid" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/payments/payos/webhook - nhận và chuyển tiếp webhook tới service", async () => {
    vi.spyOn(serviceModule, "processPayOSWebhook").mockResolvedValue({
      success: true,
      payment: {
        id: "pay-123",
        contractId: "c-1",
        kind: "DEPOSIT",
        periodNo: null,
        businessAmount: "5000000",
        expectedAmount: "2000",
        paidAmount: "2000",
        provider: "PAYOS",
        status: "CONFIRMED",
        isSimulated: false,
        qrData: null,
        checkoutUrl: null,
      },
    });

    const webhookPayload = {
      code: "00",
      desc: "success",
      success: true,
      data: {
        orderCode: 12345,
        amount: 2000,
        description: "COC 12345",
        accountNumber: "123456",
        reference: "REF",
        transactionDateTime: "2026-11-23 20:00:00",
        currency: "VND",
        paymentLinkId: "link_id",
        code: "00",
        desc: "Thành công",
      },
      signature: "sig123",
    };

    const request = new Request("http://localhost:3000/api/payments/payos/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    const response = await webhookPost(request, {} as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.success).toBe(true);
    expect(body.data.payment.status).toBe("CONFIRMED");
  });

  it("POST /api/payments/[id]/simulate-confirm - giả lập xác nhận thành công", async () => {
    vi.spyOn(serviceModule, "simulatePaymentConfirm").mockResolvedValue({
      id: "pay-123",
      contractId: "c-1",
      kind: "DEPOSIT",
      periodNo: null,
      businessAmount: "5000000",
      expectedAmount: "2000",
      paidAmount: "2000",
      provider: "SIMULATED",
      status: "CONFIRMED",
      isSimulated: true,
      qrData: null,
      checkoutUrl: null,
    });

    const request = new Request("http://localhost:3000/api/payments/pay-123/simulate-confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "user-1",
      },
      body: JSON.stringify({ scenario: "FULL" }),
    });

    const response = await simulateConfirmPost(request, {
      params: Promise.resolve({ id: "pay-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.isSimulated).toBe(true);
  });

  it("POST /api/payments/[id]/simulate-fail - giả lập thất bại", async () => {
    vi.spyOn(serviceModule, "simulatePaymentFail").mockResolvedValue({
      id: "pay-123",
      contractId: "c-1",
      kind: "DEPOSIT",
      periodNo: null,
      businessAmount: "5000000",
      expectedAmount: "2000",
      paidAmount: "0",
      provider: "SIMULATED",
      status: "FAILED",
      isSimulated: true,
      qrData: null,
      checkoutUrl: null,
    });

    const request = new Request("http://localhost:3000/api/payments/pay-123/simulate-fail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "user-1",
      },
      body: JSON.stringify({ reason: "Lỗi ngân hàng" }),
    });

    const response = await simulateFailPost(request, {
      params: Promise.resolve({ id: "pay-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("FAILED");
  });

  it("POST /api/payments/[id]/recheck - đối soát thành công", async () => {
    vi.spyOn(serviceModule, "recheckPayment").mockResolvedValue({
      id: "pay-123",
      contractId: "c-1",
      kind: "DEPOSIT",
      periodNo: null,
      businessAmount: "5000000",
      expectedAmount: "2000",
      paidAmount: "2000",
      provider: "PAYOS",
      status: "CONFIRMED",
      isSimulated: false,
      qrData: null,
      checkoutUrl: null,
    });

    const request = new Request("http://localhost:3000/api/payments/pay-123/recheck", {
      method: "POST",
    });

    const response = await recheckPost(request, {
      params: Promise.resolve({ id: "pay-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("CONFIRMED");
  });

  it("GET /api/payments/[id] - lấy thông tin thanh toán thành công", async () => {
    vi.spyOn(serviceModule, "getPaymentById").mockResolvedValue({
      id: "pay-123",
      contractId: "c-1",
      kind: "DEPOSIT",
      periodNo: null,
      businessAmount: "5000000",
      expectedAmount: "2000",
      paidAmount: "0",
      provider: "PAYOS",
      status: "PENDING",
      isSimulated: false,
      qrData: "qr_data",
      checkoutUrl: "https://payos.vn/link",
    });

    const request = new Request("http://localhost:3000/api/payments/pay-123", {
      method: "GET",
    });

    const response = await paymentGet(request, {
      params: Promise.resolve({ id: "pay-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe("pay-123");
    expect(body.data.checkoutUrl).toBe("https://payos.vn/link");
  });
});
