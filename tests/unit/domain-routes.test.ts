import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as contractsGet, POST as contractsPost } from "@/app/api/contracts/route";
import { POST as contractConfirmPost } from "@/app/api/contracts/[id]/confirm/route";
import { POST as refundApprovePost } from "@/app/api/contracts/[id]/refund/approve/route";
import { POST as deductionProposePost } from "@/app/api/contracts/[id]/deduction/propose/route";
import { POST as deductionRespondPost } from "@/app/api/deductions/[id]/respond/route";
import { POST as disputeResolvePost } from "@/app/api/contracts/[id]/dispute/resolve/route";
import { POST as contractChargePost } from "@/app/api/contracts/[id]/charges/route";
import { POST as chargePaidPost } from "@/app/api/contracts/[id]/charges/[chargeId]/paid/route";
import { POST as overdueScanPost } from "@/app/api/jobs/overdue-scan/route";
import { GET as notificationsGet } from "@/app/api/notifications/route";
import * as sessionModule from "@/lib/supabase/session";
import * as contractService from "@/domain/contracts/service";
import * as depositService from "@/domain/deposits/service";
import * as deductionService from "@/domain/deductions/service";
import * as disputeService from "@/domain/disputes/service";
import * as chargeService from "@/domain/charges/service";
import * as overdueScanService from "@/domain/jobs/overdue-scan";
import type { SessionUser } from "@/domain/dto";

describe("Domain Route Handlers & Server Permission Checks", () => {
  const landlord: SessionUser = {
    id: "user-landlord",
    role: "LANDLORD",
    fullName: "Chủ nhà Test",
    phone: "0901234567",
  };

  const tenant: SessionUser = {
    id: "user-tenant",
    role: "TENANT",
    fullName: "Người thuê Test",
    phone: "0987654321",
  };

  const emptyContext = {} as { params: Promise<Record<string, string>> };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/contracts - tạo hợp đồng thành công và trả về ContractDetailDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(contractService, "createContract").mockResolvedValue({
      id: "contract-123",
      roomLabel: "Phòng 101",
      landlordName: "Chủ nhà Test",
      tenantName: null,
      rentAmount: "5000000",
      depositAmount: "5000000",
      startDate: "2026-03-01",
      endDate: "2026-08-31",
      dueDay: 5,
      status: "PENDING_CONFIRMATION",
      depositStatus: "UNPAID",
      disputeStatus: "NONE",
      journeyStep: "SIGN",
      myRole: "LANDLORD",
      lateFeeBpsPerDay: 50,
      termsText: "Điều khoản",
      docHash: "hash-123",
      deposit: {
        status: "UNPAID",
        paidAmount: "0",
        refundAmount: "0",
        deductedAmount: "0",
        landlordRefundAmount: null,
        tenantRefundAmount: null,
      },
      rentPeriods: [],
      deductions: [],
      dispute: null,
      charges: [],
    });

    const request = new Request("http://localhost:3000/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomLabel: "Phòng 101",
        rentAmount: "5000000",
        depositAmount: "5000000",
        startDate: "2026-03-01",
        endDate: "2026-08-31",
        dueDay: 5,
        lateFeeBpsPerDay: 50,
        termsText: "Điều khoản",
      }),
    });

    const response = await contractsPost(request, emptyContext);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).toBe("contract-123");
    expect(json.data.status).toBe("PENDING_CONFIRMATION");
  });

  it("GET /api/contracts - danh sách hợp đồng trả về ContractSummaryDto[]", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(contractService, "listContracts").mockResolvedValue([
      {
        id: "contract-123",
        roomLabel: "Phòng 101",
        landlordName: "Chủ nhà Test",
        tenantName: null,
        rentAmount: "5000000",
        depositAmount: "5000000",
        startDate: "2026-03-01",
        endDate: "2026-08-31",
        dueDay: 5,
        status: "PENDING_CONFIRMATION",
        depositStatus: "UNPAID",
        disputeStatus: "NONE",
        journeyStep: "SIGN",
        myRole: "LANDLORD",
      },
    ]);

    const response = await contractsGet(new Request("http://localhost:3000/api/contracts"), emptyContext);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe("contract-123");
  });

  it("POST /api/contracts/[id]/confirm - xác nhận hợp đồng trả về ACTIVE", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(tenant);
    vi.spyOn(contractService, "confirmContract").mockResolvedValue({
      id: "contract-123",
      roomLabel: "Phòng 101",
      landlordName: "Chủ nhà Test",
      tenantName: "Người thuê Test",
      rentAmount: "5000000",
      depositAmount: "5000000",
      startDate: "2026-03-01",
      endDate: "2026-08-31",
      dueDay: 5,
      status: "ACTIVE",
      depositStatus: "UNPAID",
      disputeStatus: "NONE",
      journeyStep: "DEPOSIT",
      myRole: "TENANT",
      lateFeeBpsPerDay: 50,
      termsText: "Điều khoản",
      docHash: "hash-123",
      deposit: {
        status: "UNPAID",
        paidAmount: "0",
        refundAmount: "0",
        deductedAmount: "0",
        landlordRefundAmount: null,
        tenantRefundAmount: null,
      },
      rentPeriods: [],
      deductions: [],
      dispute: null,
      charges: [],
    });

    const response = await contractConfirmPost(
      new Request("http://localhost:3000/api/contracts/contract-123/confirm", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-123" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("ACTIVE");
    expect(json.data.journeyStep).toBe("DEPOSIT");
  });

  it("POST /api/contracts/[id]/refund/approve - duyệt hoàn cọc trả về DepositDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(depositService, "approveRefund").mockResolvedValue({
      status: "PENDING_REFUND",
      paidAmount: "5000000",
      refundAmount: "0",
      deductedAmount: "0",
      landlordRefundAmount: "5000000",
      tenantRefundAmount: null,
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/refund/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refundAmount: "5000000" }),
    });

    const response = await refundApprovePost(request, { params: Promise.resolve({ id: "contract-123" }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.landlordRefundAmount).toBe("5000000");
  });

  it("POST /api/contracts/[id]/deduction/propose - đề xuất khấu trừ trả về DeductionDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(deductionService, "proposeDeduction").mockResolvedValue({
      id: "deduct-1",
      amount: "1500000",
      reasonText: "Hỏng máy giặt",
      status: "PROPOSED",
      createdAt: "2026-03-01T00:00:00Z",
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/deduction/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "1500000", reasonText: "Hỏng máy giặt" }),
    });

    const response = await deductionProposePost(request, { params: Promise.resolve({ id: "contract-123" }) });
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.amount).toBe("1500000");
    expect(json.data.status).toBe("PROPOSED");
  });

  it("POST /api/deductions/[id]/respond - phản hồi khấu trừ trả về DeductionDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(tenant);
    vi.spyOn(deductionService, "respondDeduction").mockResolvedValue({
      id: "deduct-1",
      amount: "1500000",
      reasonText: "Hỏng máy giặt",
      status: "ACCEPTED",
      createdAt: "2026-03-01T00:00:00Z",
    });

    const request = new Request("http://localhost:3000/api/deductions/deduct-1/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: true }),
    });

    const response = await deductionRespondPost(request, { params: Promise.resolve({ id: "deduct-1" }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("ACCEPTED");
  });

  it("POST /api/contracts/[id]/dispute/resolve - giải quyết tranh chấp trả về DisputeDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(disputeService, "resolveDispute").mockResolvedValue({
      status: "RESOLVED",
      openedBy: "user-tenant",
      note: "Bất đồng",
      landlordAgreedAmount: "3800000",
      tenantAgreedAmount: "3800000",
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/dispute/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreedAmount: "3800000" }),
    });

    const response = await disputeResolvePost(request, { params: Promise.resolve({ id: "contract-123" }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe("RESOLVED");
    expect(json.data.landlordAgreedAmount).toBe("3800000");
  });

  it("GET /api/notifications & POST /api/notifications/[id]/read - hoạt động chính xác", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(tenant);

    const getRes = await notificationsGet(
      new Request("http://localhost:3000/api/notifications"),
      emptyContext,
    );
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(Array.isArray(getJson.data)).toBe(true);
  });

  it("POST /api/jobs/overdue-scan - quét quá hạn thành công với secret hợp lệ", async () => {
    vi.stubEnv("CRON_SECRET", "super-secret");
    vi.spyOn(overdueScanService, "scanOverdue").mockResolvedValue({
      scannedCount: 2,
      overdueCount: 1,
      dueSoonCount: 0,
      remindedCount: 0,
      updatedPeriods: [
        { contractId: "contract-1", periodNo: 1, daysLate: 5, lateFee: "125000" },
      ],
    });

    const request = new Request("http://localhost:3000/api/jobs/overdue-scan", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ asOfDate: "2026-03-10" }),
    });

    const response = await overdueScanPost(request, emptyContext);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.overdueCount).toBe(1);
  });

  it("POST /api/jobs/overdue-scan - từ chối khi không có secret và không ở demo mode", async () => {
    vi.stubEnv("CRON_SECRET", "super-secret");
    vi.stubEnv("DEMO_MODE", "false");
    vi.spyOn(sessionModule, "getOptionalUser").mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/jobs/overdue-scan", {
      method: "POST",
    });

    const response = await overdueScanPost(request, emptyContext);
    expect(response.status).toBe(403);
  });

  it("POST /api/contracts/[id]/charges - thêm khoản nợ thành công trả về 201 ChargeDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(chargeService, "createCharge").mockResolvedValue({
      id: "charge-123",
      periodNo: 1,
      kind: "ELECTRICITY",
      amount: "350000",
      note: "Điện tháng 1",
      status: "UNPAID",
      createdAt: "2026-03-01T00:00:00.000Z",
      paidAt: null,
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "ELECTRICITY",
        amount: "350000",
        note: "Điện tháng 1",
        periodNo: 1,
      }),
    });

    const response = await contractChargePost(request, {
      params: Promise.resolve({ id: "contract-123" }),
    });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).toBe("charge-123");
    expect(json.data.amount).toBe("350000");
    expect(json.data.status).toBe("UNPAID");
  });

  it("POST /api/contracts/[id]/charges/[chargeId]/paid - đánh dấu đã nhận trả về 200 ChargeDto", async () => {
    vi.spyOn(sessionModule, "requireUser").mockResolvedValue(landlord);
    vi.spyOn(chargeService, "markChargePaid").mockResolvedValue({
      id: "charge-123",
      periodNo: 1,
      kind: "ELECTRICITY",
      amount: "350000",
      note: "Điện tháng 1",
      status: "PAID",
      createdAt: "2026-03-01T00:00:00.000Z",
      paidAt: "2026-03-05T10:00:00.000Z",
    });

    const request = new Request("http://localhost:3000/api/contracts/contract-123/charges/charge-123/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await chargePaidPost(request, {
      params: Promise.resolve({ id: "contract-123", chargeId: "charge-123" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe("charge-123");
    expect(json.data.status).toBe("PAID");
    expect(json.data.paidAt).toBe("2026-03-05T10:00:00.000Z");
  });
});
