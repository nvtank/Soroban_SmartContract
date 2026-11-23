import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "@/domain/dto";
import type {
  ContractRow,
  DepositRow,
  PaymentEventRow,
  PaymentRow,
  RentPeriodRow,
} from "./types";

export interface PaymentRepository {
  getContract(contractId: string): Promise<ContractRow | null>;
  getDeposit(contractId: string): Promise<DepositRow | null>;
  getRentPeriod(contractId: string, periodNo: number): Promise<RentPeriodRow | null>;
  getPaymentById(paymentId: string): Promise<PaymentRow | null>;
  getPaymentByOrderCode(orderCode: bigint | number): Promise<PaymentRow | null>;
  createPayment(payment: Omit<PaymentRow, "created_at">): Promise<PaymentRow>;
  updatePayment(
    paymentId: string,
    updates: Partial<Pick<PaymentRow, "status" | "paid_amount" | "is_simulated" | "qr_data" | "checkout_url">>,
  ): Promise<PaymentRow>;
  hasPaymentEvent(provider: PaymentProvider, eventKey: string): Promise<boolean>;
  recordPaymentEvent(event: PaymentEventRow): Promise<boolean>;
  getUnderlyingDb(): unknown;
}

/**
 * Kho lưu trữ bộ nhớ (In-Memory) phục vụ kiểm thử đơn vị độc lập.
 */
export class InMemoryPaymentRepository implements PaymentRepository {
  contracts = new Map<string, ContractRow>();
  deposits = new Map<string, DepositRow>();
  rentPeriods = new Map<string, RentPeriodRow>(); // key: `${contractId}:${periodNo}`
  payments = new Map<string, PaymentRow>();
  paymentEvents = new Set<string>(); // key: `${provider}:${eventKey}`

  async getContract(contractId: string): Promise<ContractRow | null> {
    return this.contracts.get(contractId) ?? null;
  }

  async getDeposit(contractId: string): Promise<DepositRow | null> {
    return this.deposits.get(contractId) ?? null;
  }

  async getRentPeriod(contractId: string, periodNo: number): Promise<RentPeriodRow | null> {
    return this.rentPeriods.get(`${contractId}:${periodNo}`) ?? null;
  }

  async getPaymentById(paymentId: string): Promise<PaymentRow | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async getPaymentByOrderCode(orderCode: bigint | number): Promise<PaymentRow | null> {
    const codeBigInt = BigInt(orderCode);
    for (const payment of this.payments.values()) {
      if (payment.order_code === codeBigInt) {
        return payment;
      }
    }
    return null;
  }

  async createPayment(payment: Omit<PaymentRow, "created_at">): Promise<PaymentRow> {
    const row: PaymentRow = {
      ...payment,
      created_at: new Date().toISOString(),
    };
    this.payments.set(row.id, row);
    return row;
  }

  async updatePayment(
    paymentId: string,
    updates: Partial<Pick<PaymentRow, "status" | "paid_amount" | "is_simulated" | "qr_data" | "checkout_url">>,
  ): Promise<PaymentRow> {
    const existing = this.payments.get(paymentId);
    if (!existing) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    const updated: PaymentRow = {
      ...existing,
      ...updates,
    };
    this.payments.set(paymentId, updated);
    return updated;
  }

  async hasPaymentEvent(provider: PaymentProvider, eventKey: string): Promise<boolean> {
    return this.paymentEvents.has(`${provider}:${eventKey}`);
  }

  async recordPaymentEvent(event: PaymentEventRow): Promise<boolean> {
    const compositeKey = `${event.provider}:${event.event_key}`;
    if (this.paymentEvents.has(compositeKey)) {
      return false; // Trùng event
    }
    this.paymentEvents.add(compositeKey);
    return true;
  }

  getUnderlyingDb(): unknown {
    return {};
  }
}

/**
 * Kho lưu trữ Supabase (Postgres).
 */
export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getContract(contractId: string): Promise<ContractRow | null> {
    const { data, error } = await this.supabase
      .from("rental_contracts")
      .select("id, landlord_id, tenant_id, room_label, rent_amount, deposit_amount, status")
      .eq("id", contractId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      landlord_id: data.landlord_id,
      tenant_id: data.tenant_id,
      room_label: data.room_label,
      rent_amount: BigInt(data.rent_amount),
      deposit_amount: BigInt(data.deposit_amount),
      status: data.status,
    };
  }

  async getDeposit(contractId: string): Promise<DepositRow | null> {
    const { data, error } = await this.supabase
      .from("deposits")
      .select("contract_id, status, paid_amount")
      .eq("contract_id", contractId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      contract_id: data.contract_id,
      status: data.status,
      paid_amount: BigInt(data.paid_amount || 0),
    };
  }

  async getRentPeriod(contractId: string, periodNo: number): Promise<RentPeriodRow | null> {
    const { data, error } = await this.supabase
      .from("rent_periods")
      .select("contract_id, period_no, amount_due, amount_paid, late_days, late_fee, status")
      .eq("contract_id", contractId)
      .eq("period_no", periodNo)
      .maybeSingle();

    if (error || !data) return null;

    return {
      contract_id: data.contract_id,
      period_no: data.period_no,
      amount_due: BigInt(data.amount_due),
      amount_paid: BigInt(data.amount_paid || 0),
      late_days: Number(data.late_days || 0),
      late_fee: BigInt(data.late_fee || 0),
      status: data.status,
    };
  }

  async getPaymentById(paymentId: string): Promise<PaymentRow | null> {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      contract_id: data.contract_id,
      kind: data.kind,
      period_no: data.period_no,
      business_amount: BigInt(data.business_amount),
      expected_amount: BigInt(data.expected_amount),
      paid_amount: BigInt(data.paid_amount || 0),
      provider: data.provider,
      order_code: BigInt(data.order_code),
      status: data.status,
      qr_data: data.qr_data,
      checkout_url: data.checkout_url,
      is_simulated: Boolean(data.is_simulated),
      payment_ref_salt: data.payment_ref_salt,
      created_at: data.created_at,
    };
  }

  async getPaymentByOrderCode(orderCode: bigint | number): Promise<PaymentRow | null> {
    const codeStr = orderCode.toString();
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("order_code", codeStr)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      contract_id: data.contract_id,
      kind: data.kind,
      period_no: data.period_no,
      business_amount: BigInt(data.business_amount),
      expected_amount: BigInt(data.expected_amount),
      paid_amount: BigInt(data.paid_amount || 0),
      provider: data.provider,
      order_code: BigInt(data.order_code),
      status: data.status,
      qr_data: data.qr_data,
      checkout_url: data.checkout_url,
      is_simulated: Boolean(data.is_simulated),
      payment_ref_salt: data.payment_ref_salt,
      created_at: data.created_at,
    };
  }

  async createPayment(payment: Omit<PaymentRow, "created_at">): Promise<PaymentRow> {
    const insertPayload = {
      id: payment.id || randomUUID(),
      contract_id: payment.contract_id,
      kind: payment.kind,
      period_no: payment.period_no,
      business_amount: payment.business_amount.toString(),
      expected_amount: payment.expected_amount.toString(),
      paid_amount: payment.paid_amount.toString(),
      provider: payment.provider,
      order_code: payment.order_code.toString(),
      status: payment.status,
      qr_data: payment.qr_data,
      checkout_url: payment.checkout_url,
      is_simulated: payment.is_simulated,
      payment_ref_salt: payment.payment_ref_salt,
    };

    const { data, error } = await this.supabase
      .from("payments")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      contract_id: data.contract_id,
      kind: data.kind,
      period_no: data.period_no,
      business_amount: BigInt(data.business_amount),
      expected_amount: BigInt(data.expected_amount),
      paid_amount: BigInt(data.paid_amount || 0),
      provider: data.provider,
      order_code: BigInt(data.order_code),
      status: data.status,
      qr_data: data.qr_data,
      checkout_url: data.checkout_url,
      is_simulated: Boolean(data.is_simulated),
      payment_ref_salt: data.payment_ref_salt,
      created_at: data.created_at,
    };
  }

  async updatePayment(
    paymentId: string,
    updates: Partial<Pick<PaymentRow, "status" | "paid_amount" | "is_simulated" | "qr_data" | "checkout_url">>,
  ): Promise<PaymentRow> {
    const updatePayload: Record<string, unknown> = {};
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.paid_amount !== undefined) updatePayload.paid_amount = updates.paid_amount.toString();
    if (updates.is_simulated !== undefined) updatePayload.is_simulated = updates.is_simulated;
    if (updates.qr_data !== undefined) updatePayload.qr_data = updates.qr_data;
    if (updates.checkout_url !== undefined) updatePayload.checkout_url = updates.checkout_url;

    const { data, error } = await this.supabase
      .from("payments")
      .update(updatePayload)
      .eq("id", paymentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      contract_id: data.contract_id,
      kind: data.kind,
      period_no: data.period_no,
      business_amount: BigInt(data.business_amount),
      expected_amount: BigInt(data.expected_amount),
      paid_amount: BigInt(data.paid_amount || 0),
      provider: data.provider,
      order_code: BigInt(data.order_code),
      status: data.status,
      qr_data: data.qr_data,
      checkout_url: data.checkout_url,
      is_simulated: Boolean(data.is_simulated),
      payment_ref_salt: data.payment_ref_salt,
      created_at: data.created_at,
    };
  }

  async hasPaymentEvent(provider: PaymentProvider, eventKey: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("payment_events")
      .select("event_key")
      .eq("provider", provider)
      .eq("event_key", eventKey)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  }

  async recordPaymentEvent(event: PaymentEventRow): Promise<boolean> {
    const { error } = await this.supabase.from("payment_events").insert({
      provider: event.provider,
      order_code: event.order_code.toString(),
      event_key: event.event_key,
    });

    if (error) {
      // Postgres duplicate unique constraint error (code 23505)
      if (error.code === "23505" || error.message?.includes("duplicate key")) {
        return false;
      }
      throw error;
    }

    return true;
  }

  getUnderlyingDb(): unknown {
    return this.supabase;
  }
}

/**
 * Tạo repository mặc định.
 * Nếu không truyền db, thử nạp admin client từ @/lib/supabase/admin hoặc @/lib/supabase/server.
 */
export async function getDefaultPaymentRepository(injectedDb?: unknown): Promise<PaymentRepository> {
  if (injectedDb) {
    if (
      typeof injectedDb === "object" &&
      injectedDb !== null &&
      "from" in injectedDb &&
      typeof (injectedDb as { from: unknown }).from === "function"
    ) {
      return new SupabasePaymentRepository(injectedDb as SupabaseClient);
    }
    return injectedDb as PaymentRepository;
  }

  try {
    const adminMod = await import("@/lib/supabase/admin");
    if (typeof adminMod.createAdminSupabase === "function") {
      return new SupabasePaymentRepository(adminMod.createAdminSupabase());
    }
  } catch {
    // thử server supabase
  }

  try {
    const serverMod = await import("@/lib/supabase/server");
    if (typeof serverMod.createAdminSupabase === "function") {
      return new SupabasePaymentRepository(serverMod.createAdminSupabase());
    }
  } catch {
    // Không có supabase client
  }

  // Fallback in-memory
  return new InMemoryPaymentRepository();
}
