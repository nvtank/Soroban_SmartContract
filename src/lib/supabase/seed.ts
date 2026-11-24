import type { SupabaseClient } from "@supabase/supabase-js";
import { createCustodyWallet } from "@/lib/crypto/custody";

export const DEMO_USERS = {
  LANDLORD: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "landlord.demo@rentflow.local",
    phone: "0900000001",
    fullName: "Nguyễn Văn An (Chủ nhà Demo)",
    role: "LANDLORD" as const,
  },
  TENANT_1: {
    id: "00000000-0000-0000-0000-000000000002",
    email: "tenant1.demo@rentflow.local",
    phone: "0900000002",
    fullName: "Trần Thị Bình (Người thuê Demo 1)",
    role: "TENANT" as const,
  },
  TENANT_2: {
    id: "00000000-0000-0000-0000-000000000003",
    email: "tenant2.demo@rentflow.local",
    phone: "0900000003",
    fullName: "Lê Văn Cường (Người thuê Demo 2)",
    role: "TENANT" as const,
  },
};

export const DEMO_CONTRACTS = {
  CONTRACT_1: "10000000-0000-0000-0000-000000000001",
  CONTRACT_2: "10000000-0000-0000-0000-000000000002",
  CONTRACT_3: "10000000-0000-0000-0000-000000000003",
};

export async function seedDemoData(admin: SupabaseClient) {
  // 1. Ensure Auth Users and Profiles
  for (const user of Object.values(DEMO_USERS)) {
    await admin.rpc("seed_demo_user", {
      p_id: user.id,
      p_email: user.email,
      p_phone: user.phone,
      p_full_name: user.fullName,
      p_role: user.role,
    });

    // Ensure custody wallet
    await createCustodyWallet(admin, user.id);
  }

  // 2. Contract 1: ACTIVE, Deposit RECORDED, Normal rent
  await admin.from("rental_contracts").upsert({
    id: DEMO_CONTRACTS.CONTRACT_1,
    landlord_id: DEMO_USERS.LANDLORD.id,
    tenant_id: DEMO_USERS.TENANT_1.id,
    tenant_phone_invited: DEMO_USERS.TENANT_1.phone,
    room_label: "Phòng 301 - Tòa Sunrise",
    rent_amount: 5000000,
    deposit_amount: 10000000,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    due_day: 5,
    late_fee_bps_per_day: 50,
    terms_text: "Hợp đồng thuê phòng 301 tiêu chuẩn RentFlow. Giữ cọc an toàn, tự động nhắc kỳ hạn.",
    doc_hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    doc_salt: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    status: "ACTIVE",
  });

  await admin.from("deposits").upsert({
    contract_id: DEMO_CONTRACTS.CONTRACT_1,
    status: "RECORDED",
    paid_amount: 10000000,
    refund_amount: 0,
    deducted_amount: 0,
  });

  await admin.from("rent_periods").upsert([
    {
      contract_id: DEMO_CONTRACTS.CONTRACT_1,
      period_no: 1,
      due_date: "2026-02-05",
      amount_due: 5000000,
      amount_paid: 5000000,
      late_days: 0,
      late_fee: 0,
      status: "PAID",
    },
    {
      contract_id: DEMO_CONTRACTS.CONTRACT_1,
      period_no: 2,
      due_date: "2026-03-05",
      amount_due: 5000000,
      amount_paid: 0,
      late_days: 0,
      late_fee: 0,
      status: "AWAITING_PAYMENT",
    },
  ]);

  // 3. Contract 2: ACTIVE, Rent OVERDUE (with late fee)
  await admin.from("rental_contracts").upsert({
    id: DEMO_CONTRACTS.CONTRACT_2,
    landlord_id: DEMO_USERS.LANDLORD.id,
    tenant_id: DEMO_USERS.TENANT_2.id,
    tenant_phone_invited: DEMO_USERS.TENANT_2.phone,
    room_label: "Phòng 402 - Căn hộ Moonlight",
    rent_amount: 6500000,
    deposit_amount: 13000000,
    start_date: "2026-01-15",
    end_date: "2027-01-14",
    due_day: 10,
    late_fee_bps_per_day: 50,
    terms_text: "Hợp đồng thuê phòng 402 có điều khoản tính phí trễ 0.5%/ngày khi quá hạn thanh toán.",
    doc_hash: "1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    doc_salt: "1bcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    status: "ACTIVE",
  });

  await admin.from("deposits").upsert({
    contract_id: DEMO_CONTRACTS.CONTRACT_2,
    status: "RECORDED",
    paid_amount: 13000000,
    refund_amount: 0,
    deducted_amount: 0,
  });

  await admin.from("rent_periods").upsert([
    {
      contract_id: DEMO_CONTRACTS.CONTRACT_2,
      period_no: 1,
      due_date: "2026-02-10",
      amount_due: 6500000,
      amount_paid: 0,
      late_days: 5,
      late_fee: 162500, // 6500000 * 50 * 5 / 10000 = 162500
      status: "OVERDUE",
    },
  ]);

  // 4. Contract 3: PENDING_DISPUTE / Deduction proposed
  await admin.from("rental_contracts").upsert({
    id: DEMO_CONTRACTS.CONTRACT_3,
    landlord_id: DEMO_USERS.LANDLORD.id,
    tenant_id: DEMO_USERS.TENANT_1.id,
    tenant_phone_invited: DEMO_USERS.TENANT_1.phone,
    room_label: "Phòng 102 - Nhà phố Green",
    rent_amount: 4500000,
    deposit_amount: 9000000,
    start_date: "2025-06-01",
    end_date: "2026-05-31",
    due_day: 1,
    late_fee_bps_per_day: 30,
    terms_text: "Hợp đồng kết thúc, đang xử lý quyết toán hoàn cọc và khấu trừ chi phí sửa chữa.",
    doc_hash: "2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    doc_salt: "2bcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    status: "ACTIVE",
  });

  await admin.from("deposits").upsert({
    contract_id: DEMO_CONTRACTS.CONTRACT_3,
    status: "PENDING_DISPUTE",
    paid_amount: 9000000,
    refund_amount: 0,
    deducted_amount: 0,
    landlord_refund_amount: 7000000,
    tenant_refund_amount: 9000000,
  });

  await admin.from("disputes").upsert({
    contract_id: DEMO_CONTRACTS.CONTRACT_3,
    status: "IN_PROGRESS",
    opened_by: DEMO_USERS.LANDLORD.id,
    note: "Chủ nhà đề xuất khấu trừ 2.000.000₫ cho chi phí sơn lại tường; người thuê chưa đồng ý.",
    landlord_agreed_amount: 7000000,
    tenant_agreed_amount: 9000000,
  });

  // Deduction request
  const deductionId = "20000000-0000-0000-0000-000000000001";
  await admin.from("deduction_requests").upsert({
    id: deductionId,
    contract_id: DEMO_CONTRACTS.CONTRACT_3,
    amount: 2000000,
    reason_text: "Khấu trừ chi phí sơn sửa lại tường phòng khách và giặt rèm cửa hư hại.",
    reason_hash: "3123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    reason_salt: "3bcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    status: "PROPOSED",
  });

  return {
    users: DEMO_USERS,
    contracts: DEMO_CONTRACTS,
  };
}

export async function resetDemoData(admin: SupabaseClient) {
  // Clear non-core tables
  await admin.from("deduction_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("disputes").delete().neq("contract_id", "00000000-0000-0000-0000-000000000000");
  await admin.from("rent_periods").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("payment_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("onchain_txs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("deposits").delete().neq("contract_id", "00000000-0000-0000-0000-000000000000");
  await admin.from("rental_contracts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("recovery_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  return await seedDemoData(admin);
}
