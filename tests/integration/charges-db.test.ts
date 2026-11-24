import "@/../tests/setup";
import "@/../tests/safety";
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestAdminClient, createTestAnonClient, createTestUserSessionClient } from "./helpers";
import { createSupabaseDomainRepository } from "@/domain/supabase-repository";
import { createCharge, markChargePaid } from "@/domain/charges/service";
import { getContractDetail } from "@/domain/contracts/service";
import type { SessionUser } from "@/domain/dto";

describe("Contract Charges Real DB Integration (Khoản nợ điện nước & dịch vụ)", () => {
  const admin = createTestAdminClient();
  const repo = createSupabaseDomainRepository(admin);

  let landlordUser: SessionUser;
  let tenantUser: SessionUser;
  let tenantEmail: string;
  let contractId: string;
  const timestamp = Date.now();

  beforeAll(async () => {
    // Tạo user và profile thật trong DB
    const landlordEmail = `landlord_c_${timestamp}@rentflow.local`;
    tenantEmail = `tenant_c_${timestamp}@rentflow.local`;

    const resLandlord = await admin.auth.admin.createUser({
      email: landlordEmail,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Chủ nhà Test C" },
    });
    const landlordId = resLandlord.data.user!.id;

    const resTenant = await admin.auth.admin.createUser({
      email: tenantEmail,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Người thuê Test C" },
    });
    const tenantId = resTenant.data.user!.id;

    landlordUser = {
      id: landlordId,
      role: "LANDLORD",
      fullName: "Chủ nhà Test C",
      phone: `092${String(timestamp).slice(-7)}`,
    };

    tenantUser = {
      id: tenantId,
      role: "TENANT",
      fullName: "Người thuê Test C",
      phone: `093${String(timestamp).slice(-7)}`,
    };

    await admin.from("profiles").upsert([
      { id: landlordId, phone: landlordUser.phone, full_name: landlordUser.fullName, role: "LANDLORD" },
      { id: tenantId, phone: tenantUser.phone, full_name: tenantUser.fullName, role: "TENANT" },
    ]);

    // Tạo hợp đồng ACTIVE với tên phòng riêng biệt (không xoá hay đụng chạm dữ liệu chung)
    contractId = randomUUID();
    await admin.from("rental_contracts").insert({
      id: contractId,
      landlord_id: landlordId,
      tenant_id: tenantId,
      room_label: `Thử C Khoản Nợ ${timestamp}`,
      rent_amount: "5000000",
      deposit_amount: "5000000",
      start_date: "2026-03-01",
      end_date: "2026-08-31",
      due_day: 5,
      late_fee_bps_per_day: 50,
      terms_text: "Hợp đồng thử nghiệm DB thật cho Agent C",
      doc_hash: `doc_hash_${timestamp}`,
      doc_salt: `doc_salt_${timestamp}`,
      status: "ACTIVE",
    });

    await admin.from("deposits").insert({
      contract_id: contractId,
      status: "RECORDED",
      paid_amount: "5000000",
      refund_amount: "0",
      deducted_amount: "0",
    });

    await admin.from("rent_periods").insert([
      {
        contract_id: contractId,
        period_no: 1,
        due_date: "2026-03-05",
        amount_due: "5000000",
        amount_paid: "5000000",
        late_days: 0,
        late_fee: "0",
        status: "PAID",
      },
      {
        contract_id: contractId,
        period_no: 2,
        due_date: "2026-04-05",
        amount_due: "5000000",
        amount_paid: "0",
        late_days: 0,
        late_fee: "0",
        status: "AWAITING_PAYMENT",
      },
    ]);
  });

  it("ghi nhận khoản nợ mới vào database thật", async () => {
    const chargeDto = await createCharge(
      repo,
      contractId,
      {
        kind: "ELECTRICITY",
        amount: "320000",
        note: "Tiền điện tháng 3 thử nghiệm",
        periodNo: 2,
      },
      landlordUser,
    );

    expect(chargeDto.id).toBeDefined();
    expect(chargeDto.kind).toBe("ELECTRICITY");
    expect(chargeDto.amount).toBe("320000");
    expect(chargeDto.status).toBe("UNPAID");
    expect(chargeDto.paidAt).toBeNull();

    // Xác minh trực tiếp trong bảng contract_charges của Postgres
    const { data: row, error } = await admin
      .from("contract_charges")
      .select("*")
      .eq("id", chargeDto.id)
      .single();

    expect(error).toBeNull();
    expect(row).toBeDefined();
    expect(row.contract_id).toBe(contractId);
    expect(row.kind).toBe("ELECTRICITY");
    expect(String(row.amount)).toBe("320000");
    expect(row.status).toBe("UNPAID");
    expect(row.created_by).toBe(landlordUser.id);
  });

  it("chủ nhà đánh dấu đã nhận ngoài hệ thống và cập nhật trạng thái trong database", async () => {
    // Tạo khoản nợ nước
    const chargeDto = await createCharge(
      repo,
      contractId,
      {
        kind: "WATER",
        amount: "150000",
        note: "Tiền nước tháng 3",
        periodNo: 2,
      },
      landlordUser,
    );

    // Đánh dấu đã nhận
    const paidDto = await markChargePaid(repo, contractId, chargeDto.id, landlordUser);
    expect(paidDto.status).toBe("PAID");
    expect(paidDto.paidAt).toBeDefined();

    // Xác minh trong DB
    const { data: row, error } = await admin
      .from("contract_charges")
      .select("*")
      .eq("id", chargeDto.id)
      .single();

    expect(error).toBeNull();
    expect(row.status).toBe("PAID");
    expect(row.paid_at).toBeDefined();
  });

  it("getContractDetail trên DB thật trả về đầy đủ danh sách charges", async () => {
    const detail = await getContractDetail(repo, contractId, landlordUser);
    expect(detail.id).toBe(contractId);
    expect(Array.isArray(detail.charges)).toBe(true);
    expect(detail.charges.length).toBeGreaterThanOrEqual(2);

    const electricityCharge = detail.charges.find((c) => c.kind === "ELECTRICITY");
    expect(electricityCharge).toBeDefined();
    expect(electricityCharge?.amount).toBe("320000");
  });

  it("chính sách RLS: người thuê có thể SELECT khoản nợ, anon không thể truy cập", async () => {
    // 1. Client có phiên người thuê: SELECT thành công các khoản nợ của hợp đồng mình
    const tenantClient = await createTestUserSessionClient(tenantEmail, "test-password-123");
    const { data: tenantRows, error: tenantErr } = await tenantClient
      .from("contract_charges")
      .select("*")
      .eq("contract_id", contractId);

    expect(tenantErr).toBeNull();
    expect(tenantRows).toBeDefined();
    expect(tenantRows!.length).toBeGreaterThanOrEqual(2);

    // 2. Client ẩn danh (anon): bị từ chối truy cập (permission denied)
    const anonClient = createTestAnonClient();
    const { data: anonRows, error: anonErr } = await anonClient
      .from("contract_charges")
      .select("*")
      .eq("contract_id", contractId);

    expect(anonErr).not.toBeNull();
    expect(anonErr?.message).toMatch(/permission denied/i);
    expect(anonRows).toBeNull();
  });
});
