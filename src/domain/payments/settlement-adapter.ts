/**
 * Adapter gọi hàm settlePayment của Agent C.
 *
 * P0 TRUNG THỰC (TASK mục 2 & 3):
 * - TUYỆT ĐỐI KHÔNG nuốt lỗi rồi coi như đã xử lý.
 * - Thanh toán đã xác nhận mà settle lỗi phải để lại trạng thái có thể thử lại,
 *   webhook không đánh dấu xong sai.
 * - Đối chiếu bảng và cột với supabase/migrations/20261123000000_init_schema.sql:
 *   Các bảng `deposits`, `rent_periods`, `payments` KHÔNG có cột `updated_at` hoặc `settled_at`.
 *   Adapter cung cấp repo bọc SupabaseClient đảm bảo đúng schema migration thật.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SettlePaymentFn = (db: unknown, paymentId: string) => Promise<void>;

export class SettlementExecutionError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly originalError: unknown,
    message?: string,
  ) {
    super(
      message ??
        `Quyết toán thanh toán thất bại cho paymentId=${paymentId}: ${
          originalError instanceof Error ? originalError.message : String(originalError)
        }`,
    );
    this.name = "SettlementExecutionError";
  }
}

/**
 * Tạo DomainRepository tương thích 100% với schema cột trong supabase/migrations/.
 * Loại bỏ các trường ảo không tồn tại trong Postgres (updated_at, settled_at).
 */
async function createSchemaAlignedDomainRepository(supabase: SupabaseClient) {
  const { createSupabaseDomainRepository } = await import("@/domain/supabase-repository");
  const baseRepo = createSupabaseDomainRepository(supabase);

  return {
    ...baseRepo,
    deposits: {
      ...baseRepo.deposits,
      update: async (contractId: string, updates: Record<string, unknown>) => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.paid_amount !== undefined && updates.paid_amount !== null)
          row.paid_amount = updates.paid_amount.toString();
        if (updates.refund_amount !== undefined && updates.refund_amount !== null)
          row.refund_amount = updates.refund_amount.toString();
        if (updates.deducted_amount !== undefined && updates.deducted_amount !== null)
          row.deducted_amount = updates.deducted_amount.toString();
        if (updates.landlord_refund_amount !== undefined)
          row.landlord_refund_amount = updates.landlord_refund_amount?.toString() ?? null;
        if (updates.tenant_refund_amount !== undefined)
          row.tenant_refund_amount = updates.tenant_refund_amount?.toString() ?? null;

        if (Object.keys(row).length === 0) {
          return await baseRepo.deposits.findByContractId(contractId);
        }

        const { data, error } = await supabase
          .from("deposits")
          .update(row)
          .eq("contract_id", contractId)
          .select()
          .single();
        if (error) throw error;
        return {
          contract_id: data.contract_id,
          status: data.status,
          paid_amount: BigInt(data.paid_amount ?? 0),
          refund_amount: BigInt(data.refund_amount ?? 0),
          deducted_amount: BigInt(data.deducted_amount ?? 0),
          landlord_refund_amount:
            data.landlord_refund_amount != null ? BigInt(data.landlord_refund_amount) : null,
          tenant_refund_amount:
            data.tenant_refund_amount != null ? BigInt(data.tenant_refund_amount) : null,
          created_at: data.created_at,
          updated_at: data.created_at,
        };
      },
    },
    rentPeriods: {
      ...baseRepo.rentPeriods,
      update: async (contractId: string, periodNo: number, updates: Record<string, unknown>) => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.amount_paid !== undefined && updates.amount_paid !== null)
          row.amount_paid = updates.amount_paid.toString();
        if (updates.late_days !== undefined && updates.late_days !== null)
          row.late_days = updates.late_days;
        if (updates.late_fee !== undefined && updates.late_fee !== null)
          row.late_fee = updates.late_fee.toString();

        if (Object.keys(row).length === 0) {
          return await baseRepo.rentPeriods.findByPeriod(contractId, periodNo);
        }

        const { data, error } = await supabase
          .from("rent_periods")
          .update(row)
          .eq("contract_id", contractId)
          .eq("period_no", periodNo)
          .select()
          .single();
        if (error) throw error;
        return {
          contract_id: data.contract_id,
          period_no: Number(data.period_no),
          due_date: data.due_date,
          amount_due: BigInt(data.amount_due ?? 0),
          amount_paid: BigInt(data.amount_paid ?? 0),
          late_days: Number(data.late_days ?? 0),
          late_fee: BigInt(data.late_fee ?? 0),
          status: data.status,
          created_at: data.created_at,
          updated_at: data.created_at,
        };
      },
    },
    payments: {
      ...baseRepo.payments,
      update: async (id: string, updates: Record<string, unknown>) => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.paid_amount !== undefined && updates.paid_amount !== null)
          row.paid_amount = updates.paid_amount.toString();

        if (Object.keys(row).length === 0) {
          return await baseRepo.payments.findById(id);
        }

        const { data, error } = await supabase
          .from("payments")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          contract_id: data.contract_id,
          kind: data.kind,
          period_no: data.period_no != null ? Number(data.period_no) : null,
          business_amount: BigInt(data.business_amount),
          expected_amount: BigInt(data.expected_amount),
          paid_amount: BigInt(data.paid_amount),
          provider: data.provider,
          order_code: BigInt(data.order_code),
          payment_ref_salt: data.payment_ref_salt,
          status: data.status,
          qr_data: data.qr_data,
          checkout_url: data.checkout_url,
          is_simulated: Boolean(data.is_simulated),
          settled_at: data.created_at,
          created_at: data.created_at,
        };
      },
    },
  };
}

export async function callSettlePayment(
  db: unknown,
  paymentId: string,
  injectedSettleFn?: SettlePaymentFn,
): Promise<void> {
  if (injectedSettleFn) {
    try {
      await injectedSettleFn(db, paymentId);
      return;
    } catch (error) {
      throw new SettlementExecutionError(paymentId, error);
    }
  }

  try {
    const mod = await import("@/domain/contracts/settlement");
    if (typeof mod.settlePayment === "function") {
      let repoOrDb = db;
      if (
        typeof db === "object" &&
        db !== null &&
        "from" in db &&
        typeof (db as { from: unknown }).from === "function" &&
        !("contracts" in db)
      ) {
        repoOrDb = await createSchemaAlignedDomainRepository(db as SupabaseClient);
      }

      await mod.settlePayment(repoOrDb as Parameters<typeof mod.settlePayment>[0], paymentId);
      return;
    }
    throw new Error("Hàm settlePayment không tồn tại trong @/domain/contracts/settlement");
  } catch (error: unknown) {
    throw new SettlementExecutionError(paymentId, error);
  }
}


