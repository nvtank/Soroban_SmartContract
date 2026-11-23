import type {
  PaymentDto,
  PaymentKind,
  PaymentProvider,
  MoneyString,
  SessionUser,
} from "@/domain/dto";
import type {
  ContractStatus,
  DepositStatus,
  PaymentStatus,
  RentStatus,
} from "@/domain/states";

export interface PaymentRow {
  id: string;
  contract_id: string;
  kind: PaymentKind;
  period_no: number | null;
  business_amount: bigint;
  expected_amount: bigint;
  paid_amount: bigint;
  provider: PaymentProvider;
  order_code: bigint;
  status: PaymentStatus;
  qr_data: string | null;
  checkout_url: string | null;
  is_simulated: boolean;
  payment_ref_salt: string | null;
  created_at: string;
}

export interface ContractRow {
  id: string;
  landlord_id: string;
  tenant_id: string;
  room_label: string;
  rent_amount: bigint;
  deposit_amount: bigint;
  status: ContractStatus;
}

export interface DepositRow {
  contract_id: string;
  status: DepositStatus;
  paid_amount: bigint;
}

export interface RentPeriodRow {
  contract_id: string;
  period_no: number;
  amount_due: bigint;
  amount_paid: bigint;
  late_days: number;
  late_fee: bigint;
  status: RentStatus;
}

export interface PaymentEventRow {
  provider: PaymentProvider;
  order_code: bigint;
  event_key: string;
  created_at?: string;
}

export interface CreateDepositPaymentInput {
  contractId: string;
  user?: SessionUser | null;
  provider?: PaymentProvider;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreateRentPaymentInput {
  contractId: string;
  periodNo: number;
  user?: SessionUser | null;
  provider?: PaymentProvider;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface SimulateConfirmInput {
  paymentId: string;
  user?: SessionUser | null;
  scenario?: "FULL" | "UNDERPAID" | "OVERPAID";
  amount?: MoneyString | bigint | number;
}

export interface SimulateFailInput {
  paymentId: string;
  user?: SessionUser | null;
  reason?: string;
}

export function paymentRowToDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    contractId: row.contract_id,
    kind: row.kind,
    periodNo: row.period_no,
    businessAmount: row.business_amount.toString(),
    expectedAmount: row.expected_amount.toString(),
    paidAmount: row.paid_amount.toString(),
    provider: row.provider,
    status: row.status,
    isSimulated: row.is_simulated,
    qrData: row.qr_data,
    checkoutUrl: row.checkout_url,
  };
}
