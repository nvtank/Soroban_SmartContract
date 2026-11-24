import "@/../tests/setup";
import "@/../tests/safety";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestAdminClient } from "./helpers";
import { SupabasePaymentRepository } from "@/domain/payments/repository";
import {
  createDepositPayment,
  createRentPayment,
  processPayOSWebhook,
  recheckPayment,
  simulatePaymentConfirm,
} from "@/domain/payments/service";
import * as payosClientModule from "@/lib/payos/client";
import type { SessionUser } from "@/domain/dto";

describe("Payments Real DB Integration (Situations 1, 2, 4)", () => {
  const admin = createTestAdminClient();
  const repo = new SupabasePaymentRepository(admin);

  let landlordUser: SessionUser;
  let tenantUser: SessionUser;
  let contractId: string;
  let period2ContractId: string;

  beforeAll(async () => {
    process.env.PAYMENT_MODE = "both";
    process.env.DEMO_PAYMENT_AMOUNT = "2000";

    // Tạo auth users và profiles thật trong DB
    const timestamp = Date.now();
    const resLandlord = await admin.auth.admin.createUser({
      email: `landlord_db_${timestamp}@rentflow.local`,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "LANDLORD", full_name: "Chủ nhà Test DB" },
    });
    const landlordId = resLandlord.data.user!.id;

    const resTenant = await admin.auth.admin.createUser({
      email: `tenant_db_${timestamp}@rentflow.local`,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { role: "TENANT", full_name: "Người thuê Test DB" },
    });
    const tenantId = resTenant.data.user!.id;

    landlordUser = {
      id: landlordId,
      role: "LANDLORD",
      fullName: "Chủ nhà Test DB",
      phone: "0911000001",
    };

    tenantUser = {
      id: tenantId,
      role: "TENANT",
      fullName: "Người thuê Test DB",
      phone: "0911000002",
    };

    await admin.from("profiles").upsert([
      { id: landlordId, phone: landlordUser.phone, full_name: landlordUser.fullName, role: "LANDLORD" },
      { id: tenantId, phone: tenantUser.phone, full_name: tenantUser.fullName, role: "TENANT" },
    ]);

    // Hợp đồng 1
    contractId = randomUUID();
    await admin.from("rental_contracts").insert({
      id: contractId,
      landlord_id: landlordId,
      tenant_id: tenantId,
      room_label: "Phòng Real DB 301",
      rent_amount: "4000000",
      deposit_amount: "5000000",
      start_date: "2026-03-01",
      end_date: "2026-08-31",
      due_day: 5,
      late_fee_bps_per_day: 50,
      terms_text: "Hợp đồng thử nghiệm DB thật",
      status: "ACTIVE",
    });

    await admin.from("deposits").insert({
      contract_id: contractId,
      status: "UNPAID",
      paid_amount: "0",
    });

    await admin.from("rent_periods").insert({
      contract_id: contractId,
      period_no: 1,
      due_date: "2026-03-05",
      amount_due: "4000000",
      amount_paid: "0",
      late_days: 0,
      late_fee: "0",
      status: "AWAITING_PAYMENT",
    });

    // Hợp đồng 2 phục vụ kiểm thử song song
    period2ContractId = randomUUID();
    await admin.from("rental_contracts").insert({
      id: period2ContractId,
      landlord_id: landlordId,
      tenant_id: tenantId,
      room_label: "Phòng Real DB 302",
      rent_amount: "4000000",
      deposit_amount: "5000000",
      start_date: "2026-03-01",
      end_date: "2026-08-31",
      due_day: 5,
      late_fee_bps_per_day: 50,
      terms_text: "Hợp đồng thử nghiệm DB thật 2",
      status: "ACTIVE",
    });

    await admin.from("deposits").insert({
      contract_id: period2ContractId,
      status: "UNPAID",
      paid_amount: "0",
    });

    await admin.from("rent_periods").insert({
      contract_id: period2ContractId,
      period_no: 1,
      due_date: "2026-03-05",
      amount_due: "4000000",
      amount_paid: "0",
      late_days: 0,
      late_fee: "0",
      status: "AWAITING_PAYMENT",
    });
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu
    for (const cid of [contractId, period2ContractId]) {
      if (cid) {
        await admin.from("payment_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await admin.from("payments").delete().eq("contract_id", cid);
        await admin.from("rent_periods").delete().eq("contract_id", cid);
        await admin.from("deposits").delete().eq("contract_id", cid);
        await admin.from("rental_contracts").delete().eq("id", cid);
      }
    }
    if (landlordUser?.id) {
      await admin.from("profiles").delete().eq("id", landlordUser.id);
      await admin.auth.admin.deleteUser(landlordUser.id);
    }
    if (tenantUser?.id) {
      await admin.from("profiles").delete().eq("id", tenantUser.id);
      await admin.auth.admin.deleteUser(tenantUser.id);
    }
  });

  // =========================================================================
  // TÌNH HUỐNG LỖI 1:
  // Người dùng thanh toán nhưng hệ thống chưa cập nhật trạng thái
  // -> Hiển thị "Đang chờ xác nhận", nút "Kiểm tra lại", đối soát với cổng
  // =========================================================================
  describe("Tình huống lỗi 1: Webhook chưa tới -> Nút 'Kiểm tra lại' đối soát trên DB thật", () => {
    beforeEach(() => {
      vi.spyOn(payosClientModule, "isPayOSConfigured").mockReturnValue(true);
      vi.spyOn(payosClientModule, "createPayOSPaymentLink").mockResolvedValue({
        bin: "970403",
        accountNumber: "123456",
        accountName: "RENTFLOW DEMO",
        amount: 2000,
        description: "THUE",
        orderCode: 12345,
        currency: "VND",
        paymentLinkId: "mock_link_id",
        status: "PENDING",
        checkoutUrl: "https://payos.vn/mock_checkout",
        qrCode: "mock_qr_code",
      });
    });

    it("1a. Đối soát thanh toán tiền cọc: cập nhật CONFIRMED và chuyển cọc sang RECORDED", async () => {
      // Người thuê tạo payment cọc (PENDING)
      const payment = await createDepositPayment(
        {
          contractId,
          user: tenantUser,
          provider: "PAYOS",
        },
        { repo },
      );

      expect(payment.status).toBe("PENDING");
      expect(payment.expectedAmount).toBe("2000");

      // Giả lập webhook chưa tới: trạng thái trên DB thật vẫn là PENDING
      const inDbBefore = await repo.getPaymentById(payment.id);
      expect(inDbBefore?.status).toBe("PENDING");
      const depositBefore = await repo.getDeposit(contractId);
      expect(depositBefore?.status).toBe("UNPAID");

      // Mock payOS getPaymentLink trả về PAID
      vi.spyOn(payosClientModule, "isPayOSConfigured").mockReturnValue(true);
      vi.spyOn(payosClientModule, "getPayOSClient").mockReturnValue({
        paymentRequests: {
          get: vi.fn().mockResolvedValue({
            status: "PAID",
            amountPaid: 2000,
            orderCode: Number(payment.id),
          }),
        },
      } as unknown as payosClientModule.PayOS);

      // Người dùng bấm "Kiểm tra lại" (recheckPayment)
      const rechecked = await recheckPayment(payment.id, { repo });

      expect(rechecked.status).toBe("CONFIRMED");
      expect(rechecked.paidAmount).toBe("2000");

      // Kiểm tra DB thật: Payment đã chuyển CONFIRMED
      const inDbAfter = await repo.getPaymentById(payment.id);
      expect(inDbAfter?.status).toBe("CONFIRMED");
      expect(inDbAfter?.paid_amount).toBe(2000n);

      // Kiểm tra DB thật: cọc đã được quyết toán chuyển UNPAID -> RECORDED
      const depositAfter = await repo.getDeposit(contractId);
      expect(depositAfter?.status).toBe("RECORDED");
      expect(depositAfter?.paid_amount).toBe(5000000n);
    });

    it("1b. Đối soát thanh toán tiền thuê: cập nhật CONFIRMED và chuyển kỳ thuê sang PAID", async () => {
      const payment = await createRentPayment(
        {
          contractId,
          periodNo: 1,
          user: tenantUser,
          provider: "PAYOS",
        },
        { repo },
      );

      expect(payment.status).toBe("PENDING");

      // Mock payOS trả về PAID
      vi.spyOn(payosClientModule, "isPayOSConfigured").mockReturnValue(true);
      vi.spyOn(payosClientModule, "getPayOSClient").mockReturnValue({
        paymentRequests: {
          get: vi.fn().mockResolvedValue({
            status: "PAID",
            amountPaid: 2000,
          }),
        },
      } as unknown as payosClientModule.PayOS);

      const rechecked = await recheckPayment(payment.id, { repo });
      expect(rechecked.status).toBe("CONFIRMED");

      // Kiểm tra DB thật: Kỳ thuê chuyển sang PAID
      const periodAfter = await repo.getRentPeriod(contractId, 1);
      expect(periodAfter?.status).toBe("PAID");
      expect(periodAfter?.amount_paid).toBe(4000000n);
    });
  });

  // =========================================================================
  // TÌNH HUỐNG LỖI 2:
  // Webhook / thông báo xác nhận gửi nhiều lần -> Idempotent trên DB thật
  // =========================================================================
  describe("Tình huống lỗi 2: Webhook trùng lặp & đồng thời trên DB thật", () => {
    it("2a. Webhook gửi nhiều lần chỉ xử lý đúng 1 lần (idempotent qua payment_events)", async () => {
      const orderCode = 910001;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: period2ContractId,
        kind: "DEPOSIT",
        period_no: null,
        business_amount: 5000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt2a",
      });

      const webhookBody = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 2000,
          description: "COC 910001",
          accountNumber: "123456",
          reference: "TX_DUP_REAL_DB",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_dup",
          code: "00",
          desc: "Thành công",
        },
        signature: "valid_sig_dup",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

      // Lần 1: Xử lý thành công
      const result1 = await processPayOSWebhook(webhookBody, { repo });
      expect(result1.success).toBe(true);
      expect(result1.alreadyProcessed).toBeUndefined();
      expect(result1.payment?.status).toBe("CONFIRMED");

      // Lần 2 (Webhook gửi lại do mạng chập chờn):
      const result2 = await processPayOSWebhook(webhookBody, { repo });
      expect(result2.success).toBe(true);
      expect(result2.alreadyProcessed).toBe(true);

      // Kiểm tra DB thật: payment_events chỉ có đúng 1 dòng
      const { data: events } = await admin
        .from("payment_events")
        .select("*")
        .eq("order_code", orderCode.toString());
      expect(events?.length).toBe(1);
    });

    it("2b. Hai webhook đến đồng thời (concurrent): an toàn khóa unique trên DB thật", async () => {
      const orderCode = 910002;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: period2ContractId,
        kind: "RENT",
        period_no: 1,
        business_amount: 4000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt2b",
      });

      const webhookBody = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 2000,
          description: "THUE 910002",
          accountNumber: "123456",
          reference: "TX_CONCURRENT_REAL_DB",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_concurrent",
          code: "00",
          desc: "Thành công",
        },
        signature: "valid_sig_concurrent",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

      // Bắn 2 request webhook cùng 1 mili-giây
      const [resA, resB] = await Promise.all([
        processPayOSWebhook(webhookBody, { repo }),
        processPayOSWebhook(webhookBody, { repo }),
      ]);

      expect(resA.success).toBe(true);
      expect(resB.success).toBe(true);
      // Chính xác một trong hai báo alreadyProcessed=true
      const alreadyProcessedCount = [resA.alreadyProcessed, resB.alreadyProcessed].filter(Boolean).length;
      expect(alreadyProcessedCount).toBe(1);

      // DB thật chỉ ghi nhận 1 payment_event
      const { data: events } = await admin
        .from("payment_events")
        .select("*")
        .eq("order_code", orderCode.toString());
      expect(events?.length).toBe(1);
    });
  });

  // =========================================================================
  // TÌNH HUỐNG LỖI 4:
  // Thanh toán thiếu hoặc thừa -> Ghi nhận đúng (UNDERPAID / OVERPAID),
  // KHÔNG hoàn tất cọc/kỳ thuê. Webhook chữ ký đúng nhưng lệch tiền không CONFIRMED.
  // =========================================================================
  describe("Tình huống lỗi 4: Thanh toán thiếu / thừa & lệch tiền trên DB thật", () => {
    it("4a. Nộp thiếu cọc: payment là UNDERPAID, cọc trên DB thật giữ nguyên UNPAID", async () => {
      const orderCode = 910003;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: contractId,
        kind: "DEPOSIT",
        period_no: null,
        business_amount: 5000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt4a",
      });

      // Reset deposit về UNPAID
      await admin.from("deposits").update({ status: "UNPAID", paid_amount: 0 }).eq("contract_id", contractId);

      const underpaidWebhook = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 1000, // Nộp thiếu 1.000 VNĐ
          description: "COC 910003",
          accountNumber: "123456",
          reference: "TX_UNDERPAID_DEP",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_under_dep",
          code: "00",
          desc: "Thành công",
        },
        signature: "valid_sig_under_dep",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(underpaidWebhook.data);

      const result = await processPayOSWebhook(underpaidWebhook, { repo });
      expect(result.payment?.status).toBe("UNDERPAID");
      expect(result.payment?.status).not.toBe("CONFIRMED");

      // Kiểm tra DB thật: cọc vẫn là UNPAID
      const depositInDb = await repo.getDeposit(contractId);
      expect(depositInDb?.status).toBe("UNPAID");
      expect(depositInDb?.paid_amount).toBe(0n);
    });

    it("4b. Trả thiếu rồi trả tiếp đủ phần còn lại: chuyển thành CONFIRMED và cọc ghi nhận RECORDED", async () => {
      const orderCode = 910004;
      const payment = await repo.createPayment({
        id: randomUUID(),
        contract_id: contractId,
        kind: "DEPOSIT",
        period_no: null,
        business_amount: 5000000n,
        expected_amount: 2000n,
        paid_amount: 1000n,
        provider: "SIMULATED",
        order_code: BigInt(orderCode),
        status: "UNDERPAID",
        qr_data: null,
        checkout_url: null,
        is_simulated: true,
        payment_ref_salt: "salt4b",
      });

      // Người thuê nộp tiếp phần còn lại (tổng đủ 2000)
      const confirmed = await simulatePaymentConfirm(
        {
          paymentId: payment.id,
          user: tenantUser,
          amount: "2000",
        },
        { repo },
      );

      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.paidAmount).toBe("2000");

      // Kiểm tra DB thật: cọc chuyển sang RECORDED
      const depositInDb = await repo.getDeposit(contractId);
      expect(depositInDb?.status).toBe("RECORDED");
      expect(depositInDb?.paid_amount).toBe(5000000n);
    });

    it("4c. Nộp thiếu tiền thuê: payment là UNDERPAID, kỳ thuê chuyển PARTIALLY_PAID (chưa PAID)", async () => {
      const orderCode = 910005;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: period2ContractId,
        kind: "RENT",
        period_no: 1,
        business_amount: 4000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt4c",
      });

      // Reset kỳ thuê về AWAITING_PAYMENT
      await admin
        .from("rent_periods")
        .update({ status: "AWAITING_PAYMENT", amount_paid: 0 })
        .eq("contract_id", period2ContractId)
        .eq("period_no", 1);

      const underpaidRentWebhook = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 1000,
          description: "THUE 910005",
          accountNumber: "123456",
          reference: "TX_UNDERPAID_RENT",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_under_rent",
          code: "00",
          desc: "Thành công",
        },
        signature: "sig_under_rent",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(underpaidRentWebhook.data);

      const result = await processPayOSWebhook(underpaidRentWebhook, { repo });
      expect(result.payment?.status).toBe("UNDERPAID");

      // Kiểm tra DB thật: kỳ thuê là PARTIALLY_PAID, KHÔNG phải PAID
      const periodInDb = await repo.getRentPeriod(period2ContractId, 1);
      expect(periodInDb?.status).toBe("PARTIALLY_PAID");
      expect(periodInDb?.status).not.toBe("PAID");
    });

    it("4d. Nộp thừa tiền: payment là OVERPAID, ghi nhận số tiền thừa", async () => {
      const orderCode = 910006;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: period2ContractId,
        kind: "DEPOSIT",
        period_no: null,
        business_amount: 5000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt4d",
      });

      const overpaidWebhook = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 3000, // Thừa 1.000 VNĐ
          description: "COC 910006",
          accountNumber: "123456",
          reference: "TX_OVERPAID_DEP",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_over_dep",
          code: "00",
          desc: "Thành công",
        },
        signature: "sig_over_dep",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(overpaidWebhook.data);

      const result = await processPayOSWebhook(overpaidWebhook, { repo });
      expect(result.payment?.status).toBe("OVERPAID");
      expect(result.payment?.paidAmount).toBe("3000");

      const inDb = await repo.getPaymentByOrderCode(orderCode);
      expect(inDb?.status).toBe("OVERPAID");
      expect(inDb?.paid_amount).toBe(3000n);
    });

    it("4e. P0 TRUNG THỰC: Webhook chữ ký đúng nhưng số tiền lệch không được thành CONFIRMED", async () => {
      const orderCode = 910007;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: contractId,
        kind: "DEPOSIT",
        period_no: null,
        business_amount: 5000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt4e",
      });

      const mismatchWebhook = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 1999, // Lệch 1 đồng so với 2000
          description: "COC 910007",
          accountNumber: "123456",
          reference: "TX_MISMATCH_1DONG",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_mismatch",
          code: "00",
          desc: "Thành công",
        },
        signature: "valid_signature_matching_crypto",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(mismatchWebhook.data);

      const result = await processPayOSWebhook(mismatchWebhook, { repo });
      expect(result.payment?.status).toBe("UNDERPAID");
      expect(result.payment?.status).not.toBe("CONFIRMED");

      const inDb = await repo.getPaymentByOrderCode(orderCode);
      expect(inDb?.status).toBe("UNDERPAID");
      expect(inDb?.status).not.toBe("CONFIRMED");
    });

    it("4f. P0 TRUNG THỰC: Settle lỗi trên DB thật -> webhook không đánh dấu xong sai, xóa event để retry", async () => {
      const orderCode = 910008;
      await repo.createPayment({
        id: randomUUID(),
        contract_id: contractId,
        kind: "DEPOSIT",
        period_no: null,
        business_amount: 5000000n,
        expected_amount: 2000n,
        paid_amount: 0n,
        provider: "PAYOS",
        order_code: BigInt(orderCode),
        status: "PENDING",
        qr_data: null,
        checkout_url: null,
        is_simulated: false,
        payment_ref_salt: "salt4f",
      });

      const webhookBody = {
        code: "00",
        desc: "success",
        success: true,
        data: {
          orderCode,
          amount: 2000,
          description: "COC 910008",
          accountNumber: "123456",
          reference: "TX_SETTLE_FAIL_REAL_DB",
          transactionDateTime: "2026-11-23 20:00:00",
          currency: "VND",
          paymentLinkId: "link_settle_fail_db",
          code: "00",
          desc: "Thành công",
        },
        signature: "valid_sig_settle_fail",
      };

      vi.spyOn(payosClientModule, "verifyPayOSWebhook").mockResolvedValue(webhookBody.data);

      // Giả lập settlePayment bị lỗi (ví dụ lỗi mạng kết nối hoặc lock)
      const mockFailingSettle = vi.fn().mockRejectedValueOnce(new Error("Lỗi deadlock Postgres"));

      await expect(
        processPayOSWebhook(webhookBody, {
          repo,
          settlePaymentFn: mockFailingSettle,
        }),
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

      // Event key KHÔNG được lưu trong payment_events (đã bị xóa bỏ)
      const hasEvent = await repo.hasPaymentEvent("PAYOS", "payos_910008_TX_SETTLE_FAIL_REAL_DB");
      expect(hasEvent).toBe(false);

      // Khi retry thành công:
      const mockSuccessSettle = vi.fn().mockResolvedValueOnce(undefined);
      const retryResult = await processPayOSWebhook(webhookBody, {
        repo,
        settlePaymentFn: mockSuccessSettle,
      });

      expect(retryResult.success).toBe(true);
      expect(retryResult.payment?.status).toBe("CONFIRMED");

      // Event key bây giờ đã được lưu an toàn
      const hasEventAfter = await repo.hasPaymentEvent("PAYOS", "payos_910008_TX_SETTLE_FAIL_REAL_DB");
      expect(hasEventAfter).toBe(true);
    });
  });
});
