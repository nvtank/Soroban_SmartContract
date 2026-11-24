import "@/../tests/setup";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { confirmContract, createContract } from "@/domain/contracts/service";
import { settlePayment } from "@/domain/contracts/settlement";
import { approveRefund, requestRefund } from "@/domain/deposits/service";
import { proposeDeduction, respondDeduction } from "@/domain/deductions/service";
import { resolveDispute } from "@/domain/disputes/service";
import type { SessionUser } from "@/domain/dto";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";
import {
  createTestAdminClient,
  createTestAnonClient,
  createTestUserSessionClient,
} from "./helpers";

describe("flow failure cases (brief & CONTRACTS situations 5 & 6) (Real Database)", () => {
  const admin = createTestAdminClient();
  const repo = createSupabaseDomainRepository(admin);

  async function setupActiveRecordedContract() {
    const landlordId = randomUUID();
    const tenantId = randomUUID();
    const landlordPhone = `091${Date.now().toString().slice(-7)}`;
    const tenantPhone = `098${Date.now().toString().slice(-7)}`;

    const landlord: SessionUser = { id: landlordId, role: "LANDLORD", fullName: "Chủ nhà Test", phone: landlordPhone };
    const tenant: SessionUser = { id: tenantId, role: "TENANT", fullName: "Người thuê Test", phone: tenantPhone };

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

    const contract = await createContract(
      repo,
      {
        roomLabel: "Phòng 102 FailCases",
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

    const paymentId = randomUUID();
    const orderCode = BigInt(Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 900) + 300);

    await admin.from("payments").insert({
      id: paymentId,
      contract_id: contract.id,
      kind: "DEPOSIT",
      period_no: null,
      business_amount: 5000000,
      expected_amount: 5000000,
      paid_amount: 5000000,
      provider: "PAYOS",
      order_code: orderCode.toString(),
      payment_ref_salt: "salt-dep-fail",
      status: "CONFIRMED",
      is_simulated: false,
    });
    await settlePayment(admin, paymentId);

    return { contractId: contract.id, landlord, tenant };
  }

  // ========================================================
  // TÌNH HUỐNG LỖI 5:
  // Một trong hai bên không xác nhận hoàn cọc -> giữ PENDING_REFUND,
  // nhắc người chưa xác nhận, KHÔNG giải ngân.
  // ========================================================
  it("failure case 5: one party does not approve refund -> stays PENDING_REFUND, no release", async () => {
    const { contractId, landlord, tenant } = await setupActiveRecordedContract();

    await requestRefund(repo, contractId, tenant);

    // Chủ nhà đồng ý hoàn 5,000,000
    const res = await approveRefund(repo, contractId, { refundAmount: "5000000" }, landlord);

    // Trạng thái vẫn là PENDING_REFUND, không giải ngân
    expect(res.status).toBe("PENDING_REFUND");
    expect(res.landlordRefundAmount).toBe("5000000");
    expect(res.tenantRefundAmount).toBeNull();

    // Hợp đồng trong DB thật vẫn ACTIVE, cọc chưa hoàn
    const { data: dbContract } = await admin
      .from("rental_contracts")
      .select("status")
      .eq("id", contractId)
      .single();
    expect(dbContract?.status).toBe("ACTIVE");

    const { data: dbDeposit } = await admin
      .from("deposits")
      .select("status, refund_amount")
      .eq("contract_id", contractId)
      .single();
    expect(dbDeposit?.status).toBe("PENDING_REFUND");
    expect(Number(dbDeposit?.refund_amount)).toBe(0);

    // Có thông báo nhắc người chưa xác nhận trong bảng notifications
    const notifs = await repo.notifications.listByUserId(tenant.id);
    const reminderNotif = notifs.find((n) => n.type === "REFUND_AWAITING_APPROVAL");
    expect(reminderNotif).toBeDefined();
  });

  // ========================================================
  // TÌNH HUỐNG LỖI 6A:
  // Hai bên không thống nhất số tiền khấu trừ -> PENDING_DISPUTE,
  // khóa cọc, hệ thống KHÔNG tự kết luận, KHÔNG giải ngân.
  // ========================================================
  it("failure case 6A: deduction disagreement -> PENDING_DISPUTE, locked deposit, no auto-release", async () => {
    const { contractId, landlord, tenant } = await setupActiveRecordedContract();

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

    // Cọc trong DB thật bị khóa ở PENDING_DISPUTE
    const { data: dbDeposit } = await admin
      .from("deposits")
      .select("status, deducted_amount, refund_amount")
      .eq("contract_id", contractId)
      .single();
    expect(dbDeposit?.status).toBe("PENDING_DISPUTE");
    expect(Number(dbDeposit?.deducted_amount)).toBe(0);
    expect(Number(dbDeposit?.refund_amount)).toBe(0);

    // Tranh chấp được mở trong DB thật
    const { data: dbDispute } = await admin
      .from("disputes")
      .select("status")
      .eq("contract_id", contractId)
      .single();
    expect(dbDispute?.status).toBe("IN_PROGRESS");

    // Thử gọi approveRefund trong khi đang tranh chấp -> phải bị chặn (DISPUTE_LOCKED)
    await expect(
      approveRefund(repo, contractId, { refundAmount: "5000000" }, landlord),
    ).rejects.toMatchObject({ code: "DISPUTE_LOCKED" });
  });

  // ========================================================
  // TÌNH HUỐNG LỖI 6B:
  // Hai bên không thống nhất số tiền giải quyết tranh chấp -> giữ IN_PROGRESS,
  // không giải ngân.
  // ========================================================
  it("failure case 6B: dispute agreed amount mismatch -> remains IN_PROGRESS, no release", async () => {
    const { contractId, landlord, tenant } = await setupActiveRecordedContract();

    // Tạo tranh chấp qua việc từ chối khấu trừ
    const deduction = await proposeDeduction(
      repo,
      contractId,
      { amount: "2000000", reasonText: "Lý do bất đồng" },
      landlord,
    );
    await respondDeduction(repo, deduction.id, { accept: false }, tenant);

    // Chủ nhà gửi số tiền đồng ý là 3,000,000
    await resolveDispute(repo, contractId, { agreedAmount: "3000000" }, landlord);

    // Người thuê gửi số tiền đồng ý là 4,500,000 (khác nhau)
    const result = await resolveDispute(repo, contractId, { agreedAmount: "4500000" }, tenant);

    // Không thể RESOLVED
    expect(result.status).toBe("IN_PROGRESS");

    // Cọc vẫn bị khóa trong DB thật
    const { data: dbDeposit } = await admin
      .from("deposits")
      .select("status, refund_amount")
      .eq("contract_id", contractId)
      .single();
    expect(dbDeposit?.status).toBe("PENDING_DISPUTE");
    expect(Number(dbDeposit?.refund_amount)).toBe(0);
  });

  // ========================================================
  // LỖI ON-CHAIN KHÔNG LÀM HỎNG TRẠNG THÁI OFF-CHAIN
  // ========================================================
  it("onchain error does not fail off-chain state transitions", async () => {
    const landlordId = randomUUID();
    const tenantId = randomUUID();
    const landlord: SessionUser = { id: landlordId, role: "LANDLORD", fullName: "Chủ nhà Offchain", phone: `091${Date.now().toString().slice(-7)}` };
    const tenant: SessionUser = { id: tenantId, role: "TENANT", fullName: "Người thuê Offchain", phone: `098${Date.now().toString().slice(-7)}` };

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

    // Enqueue throws an error (e.g. RPC node timeout)
    const failingEnqueue = vi.fn().mockRejectedValue(new Error("RPC node timeout"));

    // Tạo hợp đồng vẫn thành công trong DB
    const contract = await createContract(
      repo,
      {
        roomLabel: "P.505 ErrorResilience",
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

    // Xác nhận hợp đồng vẫn thành công trong DB
    const confirmed = await confirmContract(repo, contract.id, tenant, new Request("http://localhost"), {
      enqueueOnchain: failingEnqueue,
    });

    expect(confirmed.status).toBe("ACTIVE");

    // Kiểm tra DB thật: hợp đồng đã là ACTIVE dù onchain thất bại
    const { data: dbContract } = await admin
      .from("rental_contracts")
      .select("status")
      .eq("id", contract.id)
      .single();
    expect(dbContract?.status).toBe("ACTIVE");
  });

  it("P0 Security: authenticated and anon clients are denied direct execution of atomic RPCs", async () => {
    const email = `auth_rpc_test_${Date.now()}@rentflow.local`;
    const password = "test-password-123";
    const authRes = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Attacker User" },
    });
    expect(authRes.error).toBeNull();
    const userId = authRes.data.user!.id;

    const userClient = await createTestUserSessionClient(email, password);
    const anonClient = createTestAnonClient();

    const dummyUuid = "00000000-0000-0000-0000-000000000000";

    // 1. Authenticated user cannot call settle_payment_atomic
    const authSettle = await userClient.rpc("settle_payment_atomic", { p_payment_id: dummyUuid });
    expect(authSettle.error).toBeDefined();
    expect(authSettle.error?.message).toMatch(/permission denied for function settle_payment_atomic/i);

    // 2. Authenticated user cannot call approve_refund_atomic (e.g. to impersonate other party)
    const authApprove = await userClient.rpc("approve_refund_atomic", {
      p_contract_id: dummyUuid,
      p_user_id: userId,
      p_role: "LANDLORD",
      p_refund_amount: 1000000,
    });
    expect(authApprove.error).toBeDefined();
    expect(authApprove.error?.message).toMatch(/permission denied for function approve_refund_atomic/i);

    // 3. Authenticated user cannot call resolve_dispute_atomic
    const authDispute = await userClient.rpc("resolve_dispute_atomic", {
      p_contract_id: dummyUuid,
      p_user_id: userId,
      p_role: "LANDLORD",
      p_agreed_amount: 1000000,
    });
    expect(authDispute.error).toBeDefined();
    expect(authDispute.error?.message).toMatch(/permission denied for function resolve_dispute_atomic/i);

    // 4. Anon user also cannot call any of these RPCs
    const anonSettle = await anonClient.rpc("settle_payment_atomic", { p_payment_id: dummyUuid });
    expect(anonSettle.error).toBeDefined();
    expect(anonSettle.error?.message).toMatch(/permission denied for function settle_payment_atomic/i);

    // Clean up test auth user
    await admin.auth.admin.deleteUser(userId);
  });
});
