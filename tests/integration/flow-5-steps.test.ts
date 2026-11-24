import { describe, expect, it, vi } from "vitest";
import { confirmContract, createContract, getContractDetail } from "@/domain/contracts/service";
import { settlePayment } from "@/domain/contracts/settlement";
import { proposeDeduction, respondDeduction } from "@/domain/deductions/service";
import { resolveDispute } from "@/domain/disputes/service";
import { scanOverdue } from "@/domain/jobs/overdue-scan";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository, type OnchainSigner } from "@/domain/repository";

describe("5-step end-to-end contract journey integration", () => {
  const landlord: SessionUser = {
    id: "landlord-e2e",
    role: "LANDLORD",
    fullName: "Chủ nhà Lê Văn C",
    phone: "0912345678",
  };

  const tenant: SessionUser = {
    id: "tenant-e2e",
    role: "TENANT",
    fullName: "Người thuê Phạm Thị D",
    phone: "0987654321",
  };

  it("completes full 5-step journey: create -> confirm -> deposit -> rent & overdue -> deduction & refund -> dispute branch", async () => {
    const repo = new FakeDomainRepository();
    await repo.profiles.create({
      id: landlord.id,
      phone: landlord.phone,
      full_name: landlord.fullName,
      role: landlord.role,
      created_at: new Date().toISOString(),
    });
    await repo.profiles.create({
      id: tenant.id,
      phone: tenant.phone,
      full_name: tenant.fullName,
      role: tenant.role,
      created_at: new Date().toISOString(),
    });

    const onchainTxs: Array<{
      contractId: string;
      action: string;
      args: unknown[];
      signer: OnchainSigner;
    }> = [];
    const enqueueMock = vi.fn().mockImplementation(async (_repo, payload) => {
      onchainTxs.push(payload);
      return { id: `tx-${onchainTxs.length}` };
    });

    // ==========================================
    // BƯỚC 1: Chủ nhà tạo hợp đồng & Người thuê xác nhận
    // ==========================================
    const contract = await createContract(
      repo,
      {
        roomLabel: "Phòng 401 Ecohome",
        rentAmount: "5000000",
        depositAmount: "5000000",
        startDate: "2026-03-01",
        endDate: "2026-08-31",
        dueDay: 5,
        lateFeeBpsPerDay: 50,
        termsText: "Hợp đồng thuê 6 tháng mẫu.",
        tenantPhoneInvited: tenant.phone,
      },
      landlord,
      { enqueueOnchain: enqueueMock },
    );

    expect(contract.status).toBe("PENDING_CONFIRMATION");
    expect(contract.journeyStep).toBe("SIGN");
    expect(contract.deposit.status).toBe("UNPAID");

    // Người thuê xem hợp đồng
    const detailForTenant = await getContractDetail(repo, contract.id, tenant);
    expect(detailForTenant.id).toBe(contract.id);

    // Người thuê xác nhận hợp đồng (yêu cầu Passkey / Step-up)
    const stepUpMock = vi.fn().mockResolvedValue(undefined);
    const confirmed = await confirmContract(repo, contract.id, tenant, new Request("http://localhost"), {
      requireStepUp: stepUpMock,
      enqueueOnchain: enqueueMock,
    });

    expect(confirmed.status).toBe("ACTIVE");
    expect(confirmed.journeyStep).toBe("DEPOSIT");
    expect(stepUpMock).toHaveBeenCalledWith(expect.anything(), tenant.id, "SIGN_CONTRACT");

    // ==========================================
    // BƯỚC 2: Nạp cọc qua VietQR -> Settlement ghi nhận cọc
    // ==========================================
    const depositPaymentId = "pay-dep-1";
    await repo.payments.create({
      id: depositPaymentId,
      contract_id: contract.id,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 5000000n,
      provider: "PAYOS",
      order_code: 990001n,
      payment_ref_salt: "salt-dep-1",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    await settlePayment(repo, depositPaymentId, { enqueueOnchain: enqueueMock });

    let updatedDetail = await getContractDetail(repo, contract.id, tenant);
    expect(updatedDetail.deposit.status).toBe("RECORDED");
    expect(updatedDetail.journeyStep).toBe("RENT");

    // ==========================================
    // BƯỚC 3: Kỳ thuê hàng tháng & Quét quá hạn
    // ==========================================
    // Giả lập quét quá hạn khi đã qua ngày 5 (ngày 15/03/2026)
    const overdueResult = await scanOverdue(
      repo,
      { asOfDate: "2026-03-15" },
      { enqueueOnchain: enqueueMock },
    );
    expect(overdueResult.overdueCount).toBe(1);

    updatedDetail = await getContractDetail(repo, contract.id, tenant);
    const p1 = updatedDetail.rentPeriods[0];
    expect(p1.status).toBe("OVERDUE");
    expect(p1.lateDays).toBe(10);
    // Phí trễ: 5,000,000 * 50 * 10 / 10,000 = 250,000 VND
    expect(p1.lateFee).toBe("250000");

    // Thanh toán tiền thuê kỳ 1
    const rentPaymentId = "pay-rent-1";
    await repo.payments.create({
      id: rentPaymentId,
      contract_id: contract.id,
      kind: "RENT",
      period_no: 1,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 5000000n,
      provider: "PAYOS",
      order_code: 990002n,
      payment_ref_salt: "salt-rent-1",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    await settlePayment(repo, rentPaymentId, { enqueueOnchain: enqueueMock });
    updatedDetail = await getContractDetail(repo, contract.id, tenant);
    expect(updatedDetail.rentPeriods[0].status).toBe("PAID");

    // ==========================================
    // BƯỚC 4: Kết thúc hợp đồng, Chủ nhà đề xuất khấu trừ nhưng Người thuê từ chối
    // ==========================================
    const deduction = await proposeDeduction(
      repo,
      contract.id,
      { amount: "1500000", reasonText: "Hỏng máy giặt và tường nhà" },
      landlord,
      { enqueueOnchain: enqueueMock },
    );
    expect(deduction.status).toBe("PROPOSED");

    // Người thuê không đồng ý -> từ chối khấu trừ -> cọc chuyển sang PENDING_DISPUTE
    await respondDeduction(repo, deduction.id, { accept: false }, tenant, new Request("http://localhost"), {
      requireStepUp: vi.fn().mockResolvedValue(undefined),
      enqueueOnchain: enqueueMock,
    });

    updatedDetail = await getContractDetail(repo, contract.id, tenant);
    expect(updatedDetail.deposit.status).toBe("PENDING_DISPUTE");
    expect(updatedDetail.journeyStep).toBe("DISPUTE");
    expect(updatedDetail.dispute?.status).toBe("IN_PROGRESS");

    // ==========================================
    // BƯỚC 5: Nhánh Tranh chấp khi có bất đồng và Thống nhất hòa giải
    // ==========================================
    // Hai bên tiến hành hòa giải và thống nhất số tiền 3,800,000 VND
    await resolveDispute(
      repo,
      contract.id,
      { agreedAmount: "3800000" },
      landlord,
      new Request("http://localhost"),
      { requireStepUp: vi.fn().mockResolvedValue(undefined), enqueueOnchain: enqueueMock },
    );

    const finalResolved = await resolveDispute(
      repo,
      contract.id,
      { agreedAmount: "3800000" },
      tenant,
      new Request("http://localhost"),
      { requireStepUp: vi.fn().mockResolvedValue(undefined), enqueueOnchain: enqueueMock },
    );

    expect(finalResolved.status).toBe("RESOLVED");

    updatedDetail = await getContractDetail(repo, contract.id, tenant);
    expect(updatedDetail.deposit.status).toBe("DEDUCTED");
    expect(updatedDetail.deposit.refundAmount).toBe("3800000");
    expect(updatedDetail.status).toBe("ENDED");

    // Toàn bộ các thao tác đã sinh onchain actions tương ứng
    const actionNames = onchainTxs.map((t) => t.action);
    expect(actionNames).toContain("create_contract");
    expect(actionNames).toContain("tenant_confirm");
    expect(actionNames).toContain("record_deposit_paid");
    expect(actionNames).toContain("mark_overdue");
    expect(actionNames).toContain("record_rent_paid");
    expect(actionNames).toContain("propose_deduction");
    expect(actionNames).toContain("respond_deduction");
    expect(actionNames).toContain("open_dispute");
    expect(actionNames).toContain("resolve_dispute");
  });
});
