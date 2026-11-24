import type { SupabaseClient } from "@supabase/supabase-js";
import type { DomainRepository } from "./repository";
import type {
  AuditLogEntity,
  ContractEntity,
  DeductionEntity,
  DepositEntity,
  DisputeEntity,
  NotificationEntity,
  PaymentEntity,
  ProfileEntity,
  RentPeriodEntity,
} from "./types";
import type {
  ContractStatus,
  DeductionStatus,
  DepositStatus,
  DisputeStatus,
  PaymentStatus,
  RentStatus,
} from "@/domain/states";
import type { PaymentKind, PaymentProvider, UserRole } from "@/domain/dto";

type ContractRow = {
  id: string;
  landlord_id: string;
  tenant_id: string | null;
  tenant_phone_invited: string | null;
  room_label: string;
  rent_amount: string | number;
  deposit_amount: string | number;
  start_date: string;
  end_date: string;
  due_day: number;
  late_fee_bps_per_day: number;
  terms_text: string;
  doc_hash: string;
  doc_salt: string;
  status: ContractStatus;
  onchain_ref: string | null;
  created_at: string;
  updated_at: string;
};

type DepositRow = {
  contract_id: string;
  status: DepositStatus;
  paid_amount: string | number | null;
  refund_amount: string | number | null;
  deducted_amount: string | number | null;
  landlord_refund_amount: string | number | null;
  tenant_refund_amount: string | number | null;
  created_at: string;
  updated_at: string;
};

type RentPeriodRow = {
  contract_id: string;
  period_no: number;
  due_date: string;
  amount_due: string | number;
  amount_paid: string | number;
  late_days: number;
  late_fee: string | number;
  status: RentStatus;
  created_at: string;
  updated_at: string;
};

type DeductionRow = {
  id: string;
  contract_id: string;
  amount: string | number;
  reason_text: string;
  reason_salt: string;
  reason_hash: string;
  status: DeductionStatus;
  created_at: string;
  updated_at: string;
};

type DisputeRow = {
  contract_id: string;
  status: DisputeStatus;
  opened_by: string | null;
  note: string | null;
  landlord_agreed_amount: string | number | null;
  tenant_agreed_amount: string | number | null;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  contract_id: string;
  kind: PaymentKind;
  period_no: number | null;
  business_amount: string | number;
  expected_amount: string | number;
  paid_amount: string | number;
  provider: PaymentProvider;
  order_code: string | number | bigint;
  payment_ref_salt: string;
  status: PaymentStatus;
  qr_data: string | null;
  checkout_url: string | null;
  is_simulated: boolean;
  settled_at: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  meta: Record<string, unknown>;
  created_at: string;
};

type ProfileRow = {
  id: string;
  phone: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

/**
 * Adapter bọc Supabase client thành DomainRepository.
 */
export function createSupabaseDomainRepository(supabase: SupabaseClient): DomainRepository {
  const repo = {
    contracts: {
      findById: async (id: string): Promise<ContractEntity | null> => {
        const { data, error } = await supabase
          .from("rental_contracts")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return null;
        return mapContractRow(data as ContractRow);
      },
      listByUserId: async (userId: string): Promise<ContractEntity[]> => {
        const { data, error } = await supabase
          .from("rental_contracts")
          .select("*")
          .or(`landlord_id.eq.${userId},tenant_id.eq.${userId}`);
        if (error || !data) return [];
        return (data as ContractRow[]).map(mapContractRow);
      },
      create: async (contract: ContractEntity): Promise<ContractEntity> => {
        const row = {
          id: contract.id,
          landlord_id: contract.landlord_id,
          tenant_id: contract.tenant_id,
          tenant_phone_invited: contract.tenant_phone_invited,
          room_label: contract.room_label,
          rent_amount: contract.rent_amount.toString(),
          deposit_amount: contract.deposit_amount.toString(),
          start_date: contract.start_date,
          end_date: contract.end_date,
          due_day: contract.due_day,
          late_fee_bps_per_day: contract.late_fee_bps_per_day,
          terms_text: contract.terms_text,
          doc_hash: contract.doc_hash,
          doc_salt: contract.doc_salt,
          status: contract.status,
          onchain_ref: contract.onchain_ref,
        };
        const { data, error } = await supabase.from("rental_contracts").insert(row).select().single();
        if (error) throw error;
        return mapContractRow(data as ContractRow);
      },
      update: async (id: string, updates: Partial<ContractEntity>): Promise<ContractEntity> => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.tenant_id !== undefined) row.tenant_id = updates.tenant_id;
        if (updates.onchain_ref !== undefined) row.onchain_ref = updates.onchain_ref;

        const { data, error } = await supabase
          .from("rental_contracts")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return mapContractRow(data as ContractRow);
      },
    },

    deposits: {
      findByContractId: async (contractId: string): Promise<DepositEntity | null> => {
        const { data, error } = await supabase
          .from("deposits")
          .select("*")
          .eq("contract_id", contractId)
          .maybeSingle();
        if (error || !data) return null;
        return mapDepositRow(data as DepositRow);
      },
      create: async (deposit: DepositEntity): Promise<DepositEntity> => {
        const row = {
          contract_id: deposit.contract_id,
          status: deposit.status,
          paid_amount: deposit.paid_amount.toString(),
          refund_amount: deposit.refund_amount.toString(),
          deducted_amount: deposit.deducted_amount.toString(),
          landlord_refund_amount: deposit.landlord_refund_amount?.toString() ?? null,
          tenant_refund_amount: deposit.tenant_refund_amount?.toString() ?? null,
        };
        const { data, error } = await supabase.from("deposits").insert(row).select().single();
        if (error) throw error;
        return mapDepositRow(data as DepositRow);
      },
      update: async (contractId: string, updates: Partial<DepositEntity>): Promise<DepositEntity> => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.paid_amount !== undefined) row.paid_amount = updates.paid_amount.toString();
        if (updates.refund_amount !== undefined) row.refund_amount = updates.refund_amount.toString();
        if (updates.deducted_amount !== undefined) row.deducted_amount = updates.deducted_amount.toString();
        if (updates.landlord_refund_amount !== undefined)
          row.landlord_refund_amount = updates.landlord_refund_amount?.toString() ?? null;
        if (updates.tenant_refund_amount !== undefined)
          row.tenant_refund_amount = updates.tenant_refund_amount?.toString() ?? null;

        const { data, error } = await supabase
          .from("deposits")
          .update(row)
          .eq("contract_id", contractId)
          .select()
          .single();
        if (error) throw error;
        return mapDepositRow(data as DepositRow);
      },
    },

    rentPeriods: {
      listByContractId: async (contractId: string): Promise<RentPeriodEntity[]> => {
        const { data, error } = await supabase
          .from("rent_periods")
          .select("*")
          .eq("contract_id", contractId)
          .order("period_no", { ascending: true });
        if (error || !data) return [];
        return (data as RentPeriodRow[]).map(mapRentPeriodRow);
      },
      findByPeriod: async (contractId: string, periodNo: number): Promise<RentPeriodEntity | null> => {
        const { data, error } = await supabase
          .from("rent_periods")
          .select("*")
          .eq("contract_id", contractId)
          .eq("period_no", periodNo)
          .maybeSingle();
        if (error || !data) return null;
        return mapRentPeriodRow(data as RentPeriodRow);
      },
      createMany: async (periods: RentPeriodEntity[]): Promise<void> => {
        if (periods.length === 0) return;
        const rows = periods.map((p) => ({
          contract_id: p.contract_id,
          period_no: p.period_no,
          due_date: p.due_date,
          amount_due: p.amount_due.toString(),
          amount_paid: p.amount_paid.toString(),
          late_days: p.late_days,
          late_fee: p.late_fee.toString(),
          status: p.status,
        }));
        const { error } = await supabase.from("rent_periods").insert(rows);
        if (error) throw error;
      },
      update: async (
        contractId: string,
        periodNo: number,
        updates: Partial<RentPeriodEntity>,
      ): Promise<RentPeriodEntity> => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.amount_paid !== undefined) row.amount_paid = updates.amount_paid.toString();
        if (updates.late_days !== undefined) row.late_days = updates.late_days;
        if (updates.late_fee !== undefined) row.late_fee = updates.late_fee.toString();

        const { data, error } = await supabase
          .from("rent_periods")
          .update(row)
          .eq("contract_id", contractId)
          .eq("period_no", periodNo)
          .select()
          .single();
        if (error) throw error;
        return mapRentPeriodRow(data as RentPeriodRow);
      },
      findOverdueCandidates: async (asOfDate: string): Promise<RentPeriodEntity[]> => {
        const { data, error } = await supabase
          .from("rent_periods")
          .select("*, rental_contracts!inner(status)")
          .eq("rental_contracts.status", "ACTIVE")
          .lt("due_date", asOfDate)
          .in("status", ["AWAITING_PAYMENT", "PARTIALLY_PAID", "OVERDUE"]);
        if (error || !data) return [];
        return (data as RentPeriodRow[]).map(mapRentPeriodRow);
      },
    },

    deductions: {
      listByContractId: async (contractId: string): Promise<DeductionEntity[]> => {
        const { data, error } = await supabase
          .from("deduction_requests")
          .select("*")
          .eq("contract_id", contractId)
          .order("created_at", { ascending: true });
        if (error || !data) return [];
        return (data as DeductionRow[]).map(mapDeductionRow);
      },
      findById: async (id: string): Promise<DeductionEntity | null> => {
        const { data, error } = await supabase.from("deduction_requests").select("*").eq("id", id).maybeSingle();
        if (error || !data) return null;
        return mapDeductionRow(data as DeductionRow);
      },
      create: async (deduction: DeductionEntity): Promise<DeductionEntity> => {
        const row = {
          id: deduction.id,
          contract_id: deduction.contract_id,
          amount: deduction.amount.toString(),
          reason_text: deduction.reason_text,
          reason_salt: deduction.reason_salt,
          reason_hash: deduction.reason_hash,
          status: deduction.status,
        };
        const { data, error } = await supabase.from("deduction_requests").insert(row).select().single();
        if (error) throw error;
        return mapDeductionRow(data as DeductionRow);
      },
      update: async (id: string, updates: Partial<DeductionEntity>): Promise<DeductionEntity> => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;

        const { data, error } = await supabase.from("deduction_requests").update(row).eq("id", id).select().single();
        if (error) throw error;
        return mapDeductionRow(data as DeductionRow);
      },
    },

    disputes: {
      findByContractId: async (contractId: string): Promise<DisputeEntity | null> => {
        const { data, error } = await supabase
          .from("disputes")
          .select("*")
          .eq("contract_id", contractId)
          .maybeSingle();
        if (error || !data) return null;
        return mapDisputeRow(data as DisputeRow);
      },
      create: async (dispute: DisputeEntity): Promise<DisputeEntity> => {
        const row = {
          contract_id: dispute.contract_id,
          status: dispute.status,
          opened_by: dispute.opened_by,
          note: dispute.note,
          landlord_agreed_amount: dispute.landlord_agreed_amount?.toString() ?? null,
          tenant_agreed_amount: dispute.tenant_agreed_amount?.toString() ?? null,
        };
        const { data, error } = await supabase.from("disputes").insert(row).select().single();
        if (error) throw error;
        return mapDisputeRow(data as DisputeRow);
      },
      update: async (contractId: string, updates: Partial<DisputeEntity>): Promise<DisputeEntity> => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.note !== undefined) row.note = updates.note;
        if (updates.landlord_agreed_amount !== undefined)
          row.landlord_agreed_amount = updates.landlord_agreed_amount?.toString() ?? null;
        if (updates.tenant_agreed_amount !== undefined)
          row.tenant_agreed_amount = updates.tenant_agreed_amount?.toString() ?? null;

        const { data, error } = await supabase
          .from("disputes")
          .update(row)
          .eq("contract_id", contractId)
          .select()
          .single();
        if (error) throw error;
        return mapDisputeRow(data as DisputeRow);
      },
    },

    payments: {
      findById: async (id: string): Promise<PaymentEntity | null> => {
        const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
        if (error || !data) return null;
        return mapPaymentRow(data as PaymentRow);
      },
      findByContractId: async (contractId: string): Promise<PaymentEntity[]> => {
        const { data, error } = await supabase.from("payments").select("*").eq("contract_id", contractId);
        if (error || !data) return [];
        return (data as PaymentRow[]).map(mapPaymentRow);
      },
      create: async (payment: PaymentEntity): Promise<PaymentEntity> => {
        const row = {
          id: payment.id,
          contract_id: payment.contract_id,
          kind: payment.kind,
          period_no: payment.period_no,
          business_amount: payment.business_amount.toString(),
          expected_amount: payment.expected_amount.toString(),
          paid_amount: payment.paid_amount.toString(),
          provider: payment.provider,
          order_code: payment.order_code.toString(),
          payment_ref_salt: payment.payment_ref_salt,
          status: payment.status,
          qr_data: payment.qr_data,
          checkout_url: payment.checkout_url,
          is_simulated: payment.is_simulated,
        };
        const { data, error } = await supabase.from("payments").insert(row).select().single();
        if (error) throw error;
        return mapPaymentRow(data as PaymentRow);
      },
      update: async (id: string, updates: Partial<PaymentEntity>): Promise<PaymentEntity> => {
        const row: Record<string, unknown> = {};
        if (updates.status !== undefined) row.status = updates.status;
        if (updates.paid_amount !== undefined) row.paid_amount = updates.paid_amount.toString();
        if (updates.settled_at !== undefined) row.settled_at = updates.settled_at;

        const { data, error } = await supabase.from("payments").update(row).eq("id", id).select().single();
        if (error) throw error;
        return mapPaymentRow(data as PaymentRow);
      },
    },

    notifications: {
      create: async (notification: NotificationEntity): Promise<void> => {
        const row = {
          id: notification.id,
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
        };
        await supabase.from("notifications").insert(row);
      },
      listByUserId: async (userId: string): Promise<NotificationEntity[]> => {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error || !data) return [];
        return (data as NotificationRow[]).map((d: NotificationRow) => ({
          id: d.id,
          user_id: d.user_id,
          type: d.type,
          title: d.title,
          body: d.body,
          read_at: d.read_at,
          created_at: d.created_at,
        }));
      },
    },

    auditLogs: {
      create: async (log: AuditLogEntity): Promise<void> => {
        const row = {
          id: log.id,
          actor_id: log.actor_id,
          action: log.action,
          entity: log.entity,
          entity_id: log.entity_id,
          meta: log.meta,
        };
        await supabase.from("audit_logs").insert(row);
      },
      listByContractId: async (contractId: string): Promise<AuditLogEntity[]> => {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("entity_id", contractId)
          .order("created_at", { ascending: true });
        if (error || !data) return [];
        return (data as AuditLogRow[]).map((d: AuditLogRow) => ({
          id: d.id,
          actor_id: d.actor_id,
          action: d.action,
          entity: d.entity,
          entity_id: d.entity_id,
          meta: d.meta,
          created_at: d.created_at,
        }));
      },
    },

    profiles: {
      findById: async (id: string): Promise<ProfileEntity | null> => {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
        if (error || !data) return null;
        const profile = data as ProfileRow;
        return {
          id: profile.id,
          phone: profile.phone,
          full_name: profile.full_name,
          role: profile.role,
          created_at: profile.created_at,
        };
      },
      findByPhone: async (phone: string): Promise<ProfileEntity | null> => {
        const { data, error } = await supabase.from("profiles").select("*").eq("phone", phone).maybeSingle();
        if (error || !data) return null;
        const profile = data as ProfileRow;
        return {
          id: profile.id,
          phone: profile.phone,
          full_name: profile.full_name,
          role: profile.role,
          created_at: profile.created_at,
        };
      },
      create: async (profile: ProfileEntity): Promise<ProfileEntity> => {
        const row = {
          id: profile.id,
          phone: profile.phone,
          full_name: profile.full_name,
          role: profile.role,
        };
        const { data, error } = await supabase.from("profiles").insert(row).select().single();
        if (error) throw error;
        const saved = data as ProfileRow;
        return {
          id: saved.id,
          phone: saved.phone,
          full_name: saved.full_name,
          role: saved.role,
          created_at: saved.created_at,
        };
      },
    },
  };

  (repo as any).from = supabase.from.bind(supabase);
  return repo;
}

function mapContractRow(data: ContractRow): ContractEntity {
  return {
    id: data.id,
    landlord_id: data.landlord_id,
    tenant_id: data.tenant_id,
    tenant_phone_invited: data.tenant_phone_invited,
    room_label: data.room_label,
    rent_amount: BigInt(data.rent_amount),
    deposit_amount: BigInt(data.deposit_amount),
    start_date: data.start_date,
    end_date: data.end_date,
    due_day: Number(data.due_day),
    late_fee_bps_per_day: Number(data.late_fee_bps_per_day),
    terms_text: data.terms_text,
    doc_hash: data.doc_hash,
    doc_salt: data.doc_salt,
    status: data.status,
    onchain_ref: data.onchain_ref,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  };
}

function mapDepositRow(data: DepositRow): DepositEntity {
  return {
    contract_id: data.contract_id,
    status: data.status,
    paid_amount: BigInt(data.paid_amount ?? 0),
    refund_amount: BigInt(data.refund_amount ?? 0),
    deducted_amount: BigInt(data.deducted_amount ?? 0),
    landlord_refund_amount: data.landlord_refund_amount != null ? BigInt(data.landlord_refund_amount) : null,
    tenant_refund_amount: data.tenant_refund_amount != null ? BigInt(data.tenant_refund_amount) : null,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  };
}

function mapRentPeriodRow(data: RentPeriodRow): RentPeriodEntity {
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
    updated_at: data.updated_at || data.created_at,
  };
}

function mapDeductionRow(data: DeductionRow): DeductionEntity {
  return {
    id: data.id,
    contract_id: data.contract_id,
    amount: BigInt(data.amount),
    reason_text: data.reason_text,
    reason_salt: data.reason_salt,
    reason_hash: data.reason_hash,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  };
}

function mapDisputeRow(data: DisputeRow): DisputeEntity {
  return {
    contract_id: data.contract_id,
    status: data.status,
    opened_by: data.opened_by,
    note: data.note,
    landlord_agreed_amount: data.landlord_agreed_amount != null ? BigInt(data.landlord_agreed_amount) : null,
    tenant_agreed_amount: data.tenant_agreed_amount != null ? BigInt(data.tenant_agreed_amount) : null,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  };
}

function mapPaymentRow(data: PaymentRow): PaymentEntity {
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
    settled_at: data.settled_at,
    created_at: data.created_at,
  };
}
