import { describe, expect, it } from "vitest";
import { createCharge, markChargePaid } from "@/domain/charges/service";
import { getContractDetail } from "@/domain/contracts/service";
import type { SessionUser } from "@/domain/dto";
import { FakeDomainRepository } from "@/domain/repository";

describe("domain charges service (khoản nợ điện nước, dịch vụ)", () => {
  const landlord: SessionUser = { id: "landlord-1", role: "LANDLORD", fullName: "Chủ nhà An", phone: "0900000001" };
  const tenant: SessionUser = { id: "tenant-1", role: "TENANT", fullName: "Người thuê Bình", phone: "0900000002" };
  const stranger: SessionUser = { id: "stranger-1", role: "TENANT", fullName: "Người ngoài", phone: "0900000003" };

  async function setupActiveContract(repo: FakeDomainRepository, status: "ACTIVE" | "PENDING_CONFIRMATION" = "ACTIVE") {
    const contractId = "contract-charges-1";
    await repo.contracts.create({
      id: contractId,
      landlord_id: landlord.id,
      tenant_id: tenant.id,
      tenant_phone_invited: tenant.phone,
      room_label: "Phòng 301 - Tòa A",
      rent_amount: 6000000n,
      deposit_amount: 6000000n,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      due_day: 5,
      late_fee_bps_per_day: 50,
      terms_text: "Hợp đồng thuê phòng mẫu",
      doc_hash: "mock-hash",
      doc_salt: "mock-salt",
      status,
      onchain_ref: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await repo.deposits.create({
      contract_id: contractId,
      status: "RECORDED",
      paid_amount: 6000000n,
      refund_amount: 0n,
      deducted_amount: 0n,
      landlord_refund_amount: null,
      tenant_refund_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await repo.rentPeriods.createMany([
      {
        contract_id: contractId,
        period_no: 1,
        due_date: "2026-01-05",
        amount_due: 6000000n,
        amount_paid: 6000000n,
        late_days: 0,
        late_fee: 0n,
        status: "PAID",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        contract_id: contractId,
        period_no: 2,
        due_date: "2026-02-05",
        amount_due: 6000000n,
        amount_paid: 0n,
        late_days: 0,
        late_fee: 0n,
        status: "AWAITING_PAYMENT",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await repo.profiles.create({
      id: landlord.id,
      phone: landlord.phone,
      full_name: landlord.fullName,
      role: "LANDLORD",
      created_at: new Date().toISOString(),
    });

    await repo.profiles.create({
      id: tenant.id,
      phone: tenant.phone,
      full_name: tenant.fullName,
      role: "TENANT",
      created_at: new Date().toISOString(),
    });

    return contractId;
  }

  it("chủ nhà thêm khoản nợ đúng quyền thành công", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo);

    const charge = await createCharge(
      repo,
      contractId,
      {
        kind: "ELECTRICITY",
        amount: "450000",
        note: "Tiền điện tháng 1 (150 kWh x 3.000đ)",
        periodNo: 2,
      },
      landlord,
    );

    expect(charge.id).toBeDefined();
    expect(charge.periodNo).toBe(2);
    expect(charge.kind).toBe("ELECTRICITY");
    expect(charge.amount).toBe("450000");
    expect(charge.note).toBe("Tiền điện tháng 1 (150 kWh x 3.000đ)");
    expect(charge.status).toBe("UNPAID");
    expect(charge.paidAt).toBeNull();
    expect(charge.createdAt).toBeDefined();

    // Kiểm tra audit log
    const auditLogs = await repo.auditLogs.listByContractId(contractId);
    const createLog = auditLogs.find((l) => l.action === "CHARGE_CREATED");
    expect(createLog).toBeDefined();
    expect(createLog?.actor_id).toBe(landlord.id);
    expect(createLog?.entity_id).toBe(charge.id);

    // Kiểm tra thông báo gửi cho người thuê
    const notifications = await repo.notifications.listByUserId(tenant.id);
    const chargeNotif = notifications.find((n) => n.type === "CHARGE_CREATED");
    expect(chargeNotif).toBeDefined();
    expect(chargeNotif?.title).toBe("Khoản nợ mới được thêm");
    expect(chargeNotif?.body).toContain("tiền điện");
    expect(chargeNotif?.body).toContain("450000");

    // Kiểm tra hiển thị trong getContractDetail
    const detail = await getContractDetail(repo, contractId, landlord);
    expect(detail.charges).toHaveLength(1);
    expect(detail.charges[0].id).toBe(charge.id);
    expect(detail.charges[0].amount).toBe("450000");
  });

  it("người thuê hoặc người ngoài không được thêm khoản nợ (FORBIDDEN)", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo);

    // Người thuê cố thêm khoản nợ
    await expect(
      createCharge(
        repo,
        contractId,
        { kind: "WATER", amount: "120000" },
        tenant,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Người ngoài cố thêm khoản nợ
    await expect(
      createCharge(
        repo,
        contractId,
        { kind: "SERVICE", amount: "150000" },
        stranger,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("số tiền sai quy cách bị từ chối (VALIDATION_ERROR)", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo);

    // Chuỗi chứa ký tự không phải số
    await expect(
      createCharge(repo, contractId, { kind: "ELECTRICITY", amount: "100k" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Số âm
    await expect(
      createCharge(repo, contractId, { kind: "ELECTRICITY", amount: "-50000" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Số 0
    await expect(
      createCharge(repo, contractId, { kind: "ELECTRICITY", amount: "0" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Số thập phân
    await expect(
      createCharge(repo, contractId, { kind: "ELECTRICITY", amount: "150.5" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Vượt giới hạn tối đa
    await expect(
      createCharge(repo, contractId, { kind: "ELECTRICITY", amount: "999999999999999999" }, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("không thể thêm khoản nợ cho hợp đồng không ACTIVE (VALIDATION_ERROR)", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo, "PENDING_CONFIRMATION");

    await expect(
      createCharge(
        repo,
        contractId,
        { kind: "SERVICE", amount: "200000" },
        landlord,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("chủ nhà đánh dấu đã nhận ngoài hệ thống thành công", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo);

    const charge = await createCharge(
      repo,
      contractId,
      { kind: "WATER", amount: "80000", note: "Nước sinh hoạt" },
      landlord,
    );
    expect(charge.status).toBe("UNPAID");

    const paidCharge = await markChargePaid(repo, contractId, charge.id, landlord);
    expect(paidCharge.status).toBe("PAID");
    expect(paidCharge.paidAt).toBeDefined();

    // Kiểm tra audit log
    const auditLogs = await repo.auditLogs.listByContractId(contractId);
    const paidLog = auditLogs.find((l) => l.action === "CHARGE_MARKED_PAID");
    expect(paidLog).toBeDefined();
    expect(paidLog?.meta?.confirmationNote).toBe("Chủ nhà xác nhận đã nhận ngoài hệ thống");

    // Kiểm tra thông báo gửi cho người thuê có nhãn xác nhận ngoài hệ thống, không ngụ ý ngân hàng
    const notifications = await repo.notifications.listByUserId(tenant.id);
    const paidNotif = notifications.find((n) => n.type === "CHARGE_PAID");
    expect(paidNotif).toBeDefined();
    expect(paidNotif?.body).toContain("xác nhận đã nhận ngoài hệ thống");
    expect(paidNotif?.body).not.toContain("ngân hàng");
    expect(paidNotif?.body).not.toContain("VietQR");
  });

  it("đánh dấu đã nhận hai lần bị từ chối (VALIDATION_ERROR)", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo);

    const charge = await createCharge(
      repo,
      contractId,
      { kind: "OTHER", amount: "50000", note: "Gửi xe phát sinh" },
      landlord,
    );

    // Lần 1: thành công
    await markChargePaid(repo, contractId, charge.id, landlord);

    // Lần 2: từ chối vì đã PAID
    await expect(
      markChargePaid(repo, contractId, charge.id, landlord),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("người thuê không có quyền đánh dấu đã nhận (FORBIDDEN)", async () => {
    const repo = new FakeDomainRepository();
    const contractId = await setupActiveContract(repo);

    const charge = await createCharge(
      repo,
      contractId,
      { kind: "SERVICE", amount: "100000" },
      landlord,
    );

    // Người thuê cố đánh dấu đã nhận
    await expect(
      markChargePaid(repo, contractId, charge.id, tenant),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
