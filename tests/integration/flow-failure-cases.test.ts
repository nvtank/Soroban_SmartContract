import { describe, expect, it, vi } from "vitest";
import { confirmContract, createContract } from "@/domain/contracts/service";
import { settlePayment } from "@/domain/contracts/settlement";
import { approveRefund, requestRefund } from "@/domain/deposits/service";
import { proposeDeduction, respondDeduction } from "@/domain/deductions/service";
import { resolveDispute } from "@/domain/disputes/service";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository } from "@/domain/repository";

describe("flow failure cases (brief & CONTRACTS situations 5 & 6)", () => {
  const landlord: SessionUser = { id: "landlord-fail", role: "LANDLORD", fullName: "Chủ nhà", phone: "0901" };
  const tenant: SessionUser = { id: "tenant-fail", role: "TENANT", fullName: "Người thuê", phone: "0902" };

  async function setupActiveRecordedContract(repo: FakeDomainRepository) {
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

    const contract = await createContract(
      repo,
      {
        roomLabel: "Phòng 102",
        rentAmount: "5000000",
        depositAmount: "5000000",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        dueDay: 5,
        lateFeeBpsPerDay: 50,
        termsText: "Terms",
        tenantPhoneInvited: tenant.phone,
      },
      landlord,
    );

    await confirmContract(repo, contract.id, tenant);

    const paymentId = "pay-dep-fail";
    await repo.payments.create({
      id: paymentId,
      contract_id: contract.id,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000n,
      expected_amount: 5000000n,
      paid_amount: 5000000n,
      provider: "PAYOS",
      order_code: 88001n,
      payment_ref_salt: "salt-dep",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
      settled_at: null,
      created_at: new Date().toISOString(),
    });
    await settlePayment(repo, paymentId);

    return contract.id;
  }

  // ========================================================
  // TÌNH HUỐNG LỖI 5:
  // Một trong hai bên không xác nhận hoàn cọc -> giữ PENDING_REFUND,
  // nhắc người chưa xác nhận, KHÔNG giải ngân.
  // ========================================================
  it("failure case 5: one party does not approve refund -> stays PENDING_REFUND, no release", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveRecordedContract(repo);

    await requestRefund(repo, contractId, tenant);

    // Chủ nhà đồng ý hoàn 5,000,000
    const res = await approveRefund(repo, contractId, { refundAmount: "5000000" }, landlord);

    // Trạng thái vẫn là PENDING_REFUND, không giải ngân
    expect(res.status).toBe("PENDING_REFUND");
    expect(res.landlordRefundAmount).toBe("5000000");
    expect(res.tenantRefundAmount).toBeNull();

    // Hợp đồng vẫn ACTIVE, cọc chưa hoàn
    const contract = await repo.contracts.findById(contractId);
    expect(contract?.status).toBe("ACTIVE");

    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_REFUND");
    expect(deposit?.refund_amount).toBe(0n);

    // Có thông báo nhắc người chưa xác nhận
    const notifs = await repo.notifications.listByUserId(tenant.id);
    const reminderNotif = notifs.find((n) => n.type === "REFUND_AWAITING_APPROVAL");
    expect(reminderNotif).toBeDefined();
  });

  // ========================================================
  // TÌNH HUỐNG LỖI 6:
  // Hai bên không thống nhất số tiền khấu trừ -> PENDING_DISPUTE,
  // khóa cọc, hệ thống KHÔNG tự kết luận, KHÔNG giải ngân.
  // ========================================================
  it("failure case 6A: deduction disagreement -> PENDING_DISPUTE, locked deposit, no auto-release", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveRecordedContract(repo);

    // Chủ nhà đề xuất trừ 2,000,000 VND
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "2000000", reasonText: "Làm vỡ kính cửa sổ" },
      landlord,
    );

    // Người thuê từ chối
    const responded = await respondDeduction(repo, deduction.id, { accept: false }, tenant);
    expect(responded.status).toBe("REJECTED");

    // Cọc bị khóa ở PENDING_DISPUTE
    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_DISPUTE");
    expect(deposit?.deducted_amount).toBe(0n);
    expect(deposit?.refund_amount).toBe(0n);

    // Tranh chấp được mở
    const dispute = await repo.disputes.findByContractId(contractId);
    expect(dispute?.status).toBe("IN_PROGRESS");

    // Thử gọi approveRefund trong khi đang tranh chấp -> phải bị chặn (DISPUTE_LOCKED)
    await expect(
      approveRefund(repo, contractId, { refundAmount: "5000000" }, landlord),
    ).rejects.toMatchObject({ code: "DISPUTE_LOCKED" });
  });

  it("failure case 6B: dispute agreed amount mismatch -> remains IN_PROGRESS, no release", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveRecordedContract(repo);

    // Tạo tranh chấp qua việc từ chối khấu trừ
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "2000000", reasonText: "Lý do" },
      landlord,
    );
    await respondDeduction(repo, deduction.id, { accept: false }, tenant);

    // Chủ nhà gửi số tiền đồng ý là 3,000,000
    await resolveDispute(repo, contractId, { agreedAmount: "3000000" }, landlord);

    // Người thuê gửi số tiền đồng ý là 4,500,000 (khác nhau)
    const result = await resolveDispute(repo, contractId, { agreedAmount: "4500000" }, tenant);

    // Không thể RESOLVED
    expect(result.status).toBe("IN_PROGRESS");

    // Cọc vẫn bị khóa
    const deposit = await repo.deposits.findByContractId(contractId);
    expect(deposit?.status).toBe("PENDING_DISPUTE");
    expect(deposit?.refund_amount).toBe(0n);
  });

  // ========================================================
  // LỖI ON-CHAIN KHÔNG LÀM HỎNG TRẠNG THÁI OFF-CHAIN
  // ========================================================
  it("onchain error does not fail off-chain state transitions", async () => {
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

    // Enqueue throws an error (e.g. RPC down or timeout)
    const failingEnqueue = vi.fn().mockRejectedValue(new Error("RPC node timeout"));

    // Tạo hợp đồng vẫn thành công
    const contract = await createContract(
      repo,
      {
        roomLabel: "P.505",
        rentAmount: "4000000",
        depositAmount: "4000000",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        dueDay: 5,
        lateFeeBpsPerDay: 50,
        termsText: "Terms",
        tenantPhoneInvited: tenant.phone,
      },
      landlord,
      { enqueueOnchain: failingEnqueue },
    );

    expect(contract.id).toBeDefined();
    expect(contract.status).toBe("PENDING_CONFIRMATION");

    // Xác nhận hợp đồng vẫn thành công
    const confirmed = await confirmContract(repo, contract.id, tenant, new Request("http://localhost"), {
      enqueueOnchain: failingEnqueue,
    });

    expect(confirmed.status).toBe("ACTIVE");
  });
});
