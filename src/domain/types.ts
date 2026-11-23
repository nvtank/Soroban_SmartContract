import type {
  ContractStatus,
  DeductionStatus,
  DepositStatus,
  DisputeStatus,
  JourneyStep,
  MoneyString,
  PaymentKind,
  PaymentProvider,
  PaymentStatus,
  RentStatus,
  UserRole,
} from "@/domain/dto";

export type ProfileEntity = {
  id: string;
  phone: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type ContractEntity = {
  id: string;
  landlord_id: string;
  tenant_id: string | null;
  tenant_phone_invited: string | null;
  room_label: string;
  rent_amount: bigint;
  deposit_amount: bigint;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
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

export type DepositEntity = {
  contract_id: string;
  status: DepositStatus;
  paid_amount: bigint;
  refund_amount: bigint;
  deducted_amount: bigint;
  landlord_refund_amount: bigint | null;
  tenant_refund_amount: bigint | null;
  created_at: string;
  updated_at: string;
};

export type RentPeriodEntity = {
  contract_id: string;
  period_no: number;
  due_date: string; // YYYY-MM-DD
  amount_due: bigint;
  amount_paid: bigint;
  late_days: number;
  late_fee: bigint;
  status: RentStatus;
  created_at: string;
  updated_at: string;
};

export type DeductionEntity = {
  id: string;
  contract_id: string;
  amount: bigint;
  reason_text: string;
  reason_salt: string;
  reason_hash: string;
  status: DeductionStatus;
  created_at: string;
  updated_at: string;
};

export type DisputeEntity = {
  contract_id: string;
  status: DisputeStatus;
  opened_by: string | null;
  note: string | null;
  landlord_agreed_amount: bigint | null;
  tenant_agreed_amount: bigint | null;
  created_at: string;
  updated_at: string;
};

export type PaymentEntity = {
  id: string;
  contract_id: string;
  kind: PaymentKind;
  period_no: number | null;
  business_amount: bigint;
  expected_amount: bigint;
  paid_amount: bigint;
  provider: PaymentProvider;
  order_code: bigint;
  payment_ref_salt: string;
  status: PaymentStatus;
  qr_data: string | null;
  checkout_url: string | null;
  is_simulated: boolean;
  settled_at: string | null;
  created_at: string;
};

export type NotificationEntity = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type AuditLogEntity = {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  meta: Record<string, unknown>;
  created_at: string;
};

/**
 * Tính JourneyStep theo hợp đồng, cọc và tranh chấp
 */
export function computeJourneyStep(
  contractStatus: ContractStatus,
  depositStatus: DepositStatus,
  disputeStatus: DisputeStatus,
): JourneyStep {
  if (
    disputeStatus === "IN_PROGRESS" ||
    disputeStatus === "AWAITING_CONFIRMATION" ||
    depositStatus === "PENDING_DISPUTE"
  ) {
    return "DISPUTE";
  }
  if (contractStatus === "PENDING_CONFIRMATION") {
    return "SIGN";
  }
  if (depositStatus === "UNPAID") {
    return "DEPOSIT";
  }
  if (depositStatus === "PENDING_REFUND" || depositStatus === "REFUNDED" || depositStatus === "DEDUCTED") {
    return "SETTLE";
  }
  return "RENT";
}
