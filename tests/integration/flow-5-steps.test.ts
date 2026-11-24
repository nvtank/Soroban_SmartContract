import "@/../tests/setup";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { confirmContract, createContract, getContractDetail } from "@/domain/contracts/service";
import { settlePayment } from "@/domain/contracts/settlement";
import { approveRefund, requestRefund } from "@/domain/deposits/service";
import { proposeDeduction, respondDeduction } from "@/domain/deductions/service";
import { resolveDispute } from "@/domain/disputes/service";
import { scanOverdue } from "@/domain/jobs/overdue-scan";
import type { SessionUser } from "@/domain/dto";
import type { OnchainSigner } from "@/domain/repository";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";
import { createTestAdminClient } from "./helpers";

describe("5-step end-to-end contract journey integration (Real Database)", () => {
  const admin = createTestAdminClient();
  const repo = createSupabaseDomainRepository(admin);

  const landlordId = randomUUID();
  const tenantId = randomUUID();
  const landlordPhone = `091${Date.now().toString().slice(-7)}`;
  const tenantPhone = `098${Date.now().toString().slice(-7)}`;

  const landlord: SessionUser = {
    id: landlordId,
    role: "LANDLORD",
    fullName: "Chủ nhà Lê Văn C",
    phone: landlordPhone,
  };

  const tenant: SessionUser = {
    id: tenantId,
    role: "TENANT",
    fullName: "Người thuê Phạm Thị D",
    phone: tenantPhone,
  };

  it("completes full 5-step journey and handles concurrency on real DB", async () => {
    // 0. Tạo người dùng mẫu trong DB thật qua RPC seed_demo_user
    await admin.rpc("seed_demo_user", {
      p_id: landlord.id,
      p_email: `landlord_${landlord.id.slice(0, 8)}@rentflow.local`,
      p_phone: landlord.phone,
      p_full_name: landlord.fullName,
      p_role: landlord.role,
    });

    await admin.rpc("seed_demo_user", {
      p_id: tenant.id,
      p_email: `tenant_${tenant.id.slice(0, 8)}@rentflow.local`,
      p_phone: tenant.phone,
      p_full_name: tenant.fullName,
      p_role: tenant.role,
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

    // Kiểm tra trực tiếp trong PostgreSQL thật
    const { data: dbContractBefore } = await admin
      .from("rental_contracts")
      .select("id, status, landlord_id")
      .eq("id", contract.id)
      .single();
    expect(dbContractBefore?.status).toBe("PENDING_CONFIRMATION");
    expect(dbContractBefore?.landlord_id).toBe(landlord.id);

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

    // Kiểm tra PostgreSQL: trạng thái đã là ACTIVE và tenant_id đã gán
    const { data: dbContractAfter } = await admin
      .from("rental_contracts")
      .select("id, status, tenant_id")
      .eq("id", contract.id)
      .single();
    expect(dbContractAfter?.status).toBe("ACTIVE");
    expect(dbContractAfter?.tenant_id).toBe(tenant.id);

    // ==========================================
    // BƯỚC 2: Nạp cọc qua VietQR -> Settlement ghi nhận cọc
    // ==========================================
    const depositPaymentId = randomUUID();
    const orderCode1 = BigInt(Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 900) + 100);

    await admin.from("payments").insert({
      id: depositPaymentId,
      contract_id: contract.id,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000,
      expected_amount: 5000000,
      paid_amount: 5000000,
      provider: "PAYOS",
      order_code: orderCode1.toString(),
      payment_ref_salt: "salt-dep-1",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
    });

    // Thử nghiệm gọi đồng thời settlePayment (Requirement 4)
    await Promise.all([
      settlePayment(admin, depositPaymentId, { enqueueOnchain: enqueueMock }),
      settlePayment(admin, depositPaymentId, { enqueueOnchain: enqueueMock }),
    ]);

    let updatedDetail = await getContractDetail(repo, contract.id, tenant);
    expect(updatedDetail.deposit.status).toBe("RECORDED");
    expect(updatedDetail.journeyStep).toBe("RENT");

    // Kiểm tra DB thật: cọc đã ghi nhận, settled_at đã có
    const { data: dbDeposit } = await admin
      .from("deposits")
      .select("status, paid_amount")
      .eq("contract_id", contract.id)
      .single();
    expect(dbDeposit?.status).toBe("RECORDED");
    expect(Number(dbDeposit?.paid_amount)).toBe(5000000);

    const { data: dbPayment } = await admin
      .from("payments")
      .select("settled_at")
      .eq("id", depositPaymentId)
      .single();
    expect(dbPayment?.settled_at).not.toBeNull();

    // ==========================================
    // BƯỚC 3: Kỳ thuê hàng tháng & Quét quá hạn
    // ==========================================
    // Giả lập quét quá hạn khi đã qua ngày 5 (ngày 15/03/2026)
    const overdueResult1 = await scanOverdue(
      repo,
      { asOfDate: "2026-03-15", contractId: contract.id },
      { enqueueOnchain: enqueueMock },
    );
    expect(overdueResult1.overdueCount).toBe(1);

    updatedDetail = await getContractDetail(repo, contract.id, tenant);
    const p1 = updatedDetail.rentPeriods[0];
    expect(p1.status).toBe("OVERDUE");
    expect(p1.lateDays).toBe(10);
    // Phí trễ: 5,000,000 * 50 * 10 / 10,000 = 250,000 VND
    expect(p1.lateFee).toBe("250000");

    // Quét quá hạn lần 2 trong cùng ngày -> Idempotent, không cộng phí hai lần (Requirement 5)
    const overdueResult2 = await scanOverdue(
      repo,
      { asOfDate: "2026-03-15", contractId: contract.id },
      { enqueueOnchain: enqueueMock },
    );
    expect(overdueResult2.overdueCount).toBe(0);

    const { data: dbPeriodAfterIdem } = await admin
      .from("rent_periods")
      .select("status, late_days, late_fee")
      .eq("contract_id", contract.id)
      .eq("period_no", 1)
      .single();
    expect(Number(dbPeriodAfterIdem?.late_fee)).toBe(250000); // Không bị nhân đôi lên 500,000

    // Thanh toán tiền thuê kỳ 1
    const rentPaymentId = randomUUID();
    const orderCode2 = BigInt(Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 900) + 101);

    await admin.from("payments").insert({
      id: rentPaymentId,
      contract_id: contract.id,
      kind: "RENT",
      period_no: 1,
      business_amount: 5000000,
      expected_amount: 5000000,
      paid_amount: 5000000,
      provider: "PAYOS",
      order_code: orderCode2.toString(),
      payment_ref_salt: "salt-rent-1",
      status: "CONFIRMED",
      qr_data: null,
      checkout_url: null,
      is_simulated: false,
    });

    await settlePayment(admin, rentPaymentId, { enqueueOnchain: enqueueMock });
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

    // Người thuê từ chối khấu trừ -> cọc chuyển sang PENDING_DISPUTE
    await respondDeduction(repo, deduction.id, { accept: false }, tenant, new Request("http://localhost"), {
      requireStepUp: vi.fn().mockResolvedValue(undefined),
      enqueueOnchain: enqueueMock,
    });

    updatedDetail = await getContractDetail(repo, contract.id, tenant);
    expect(updatedDetail.deposit.status).toBe("PENDING_DISPUTE");
    expect(updatedDetail.journeyStep).toBe("DISPUTE");
    expect(updatedDetail.dispute?.status).toBe("IN_PROGRESS");

    // Kiểm tra PostgreSQL DB
    const { data: dbDepositDisputed } = await admin
      .from("deposits")
      .select("status")
      .eq("contract_id", contract.id)
      .single();
    expect(dbDepositDisputed?.status).toBe("PENDING_DISPUTE");

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

    // Kiểm tra DB: hợp đồng đã ENDED, cọc đã DEDUCTED với đúng số tiền
    const { data: dbContractFinal } = await admin
      .from("rental_contracts")
      .select("status")
      .eq("id", contract.id)
      .single();
    expect(dbContractFinal?.status).toBe("ENDED");

    // ==========================================
    // KIỂM TRA ĐỒNG THỜI DUYỆT HOÀN CỌC (Requirement 3: Hai bên cùng duyệt không giải ngân 2 lần)
    // ==========================================
    const contractConc = await createContract(
      repo,
      {
        roomLabel: "Phòng 202 Concurrency",
        rentAmount: "4000000",
        depositAmount: "4000000",
        startDate: "2026-04-01",
        endDate: "2026-09-30",
        dueDay: 1,
        lateFeeBpsPerDay: 50,
        termsText: "Terms",
        tenantPhoneInvited: tenant.phone,
      },
      landlord,
    );
    await confirmContract(repo, contractConc.id, tenant);

    const concDepPayId = randomUUID();
    await admin.from("payments").insert({
      id: concDepPayId,
      contract_id: contractConc.id,
      kind: "DEPOSIT",
      business_amount: 4000000,
      expected_amount: 4000000,
      paid_amount: 4000000,
      provider: "PAYOS",
      order_code: BigInt(Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 900) + 200).toString(),
      payment_ref_salt: "salt-conc",
      status: "CONFIRMED",
      is_simulated: false,
    });
    await settlePayment(admin, concDepPayId);
    await requestRefund(repo, contractConc.id, tenant);

    // Chủ nhà đã approve 4,000,000
    await approveRefund(repo, contractConc.id, { refundAmount: "4000000" }, landlord);

    // Người thuê gửi 2 request approveRefund đồng thời (cùng số tiền 4,000,000)
    let releaseCount = 0;
    const trackingEnqueue = vi.fn().mockImplementation(async (_r, p) => {
      if (p.action === "approve_refund") releaseCount++;
      return { id: "tx-conc" };
    });

    const [concRes1, concRes2] = await Promise.all([
      approveRefund(repo, contractConc.id, { refundAmount: "4000000" }, tenant, undefined, {
        enqueueOnchain: trackingEnqueue,
      }),
      approveRefund(repo, contractConc.id, { refundAmount: "4000000" }, tenant, undefined, {
        enqueueOnchain: trackingEnqueue,
      }),
    ]);

    expect(concRes1.status).toBe("REFUNDED");
    expect(concRes2.status).toBe("REFUNDED");
    // Chỉ giải ngân đúng 1 lần duy nhất trên onchain outbox
    expect(releaseCount).toBe(1);

    // ==========================================
    // KIỂM TRA ON-CHAIN ACTIONS VÀ KHÔNG CHỨA PII (Requirement 8)
    // ==========================================
    const actionNames = onchainTxs.map((t) => t.action);
    expect(actionNames).toContain("create_contract");
    expect(actionNames).toContain("tenant_confirm");
    expect(actionNames).toContain("record_deposit_paid");
    expect(actionNames).toContain("mark_overdue");
    expect(actionNames).toContain("record_rent_paid");
    expect(actionNames).toContain("propose_deduction");
    expect(actionNames).toContain("respond_deduction");
    // Người thuê từ chối khấu trừ: contract tự mở tranh chấp trong respond_deduction(false),
    // nên không được gọi thêm open_dispute (contract sẽ từ chối vì sai trạng thái).
    expect(actionNames).not.toContain("open_dispute");
    expect(actionNames).toContain("resolve_dispute");

    // Đảm bảo TUYỆT ĐỐI không có PII trong mọi tham số on-chain
    for (const tx of onchainTxs) {
      const serialized = JSON.stringify(tx.args);
      expect(serialized).not.toContain(landlordPhone);
      expect(serialized).not.toContain(tenantPhone);
      expect(serialized).not.toContain("Lê Văn C");
      expect(serialized).not.toContain("Phạm Thị D");
      expect(serialized).not.toContain("Ecohome");
      expect(serialized).not.toContain("Hỏng máy giặt"); // Chỉ truyền hash lý do, không truyền văn bản trần
    }
  });
});
