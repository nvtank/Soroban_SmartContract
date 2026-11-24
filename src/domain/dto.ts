import type {
  ContractStatus,
  DeductionStatus,
  DepositStatus,
  DisputeStatus,
  OnchainTxStatus,
  PaymentStatus,
  RentStatus,
} from "@/domain/states";

/** Tiền VND dạng chuỗi số nguyên, vì JSON không biểu diễn được bigint. */
export type MoneyString = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type UserRole = "LANDLORD" | "TENANT" | "ADMIN_DEMO";
export type PaymentKind = "DEPOSIT" | "RENT";
export type PaymentProvider = "PAYOS" | "SIMULATED";
export type JourneyStep = "SIGN" | "DEPOSIT" | "RENT" | "SETTLE" | "DISPUTE";

export type SessionUser = {
  id: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
};

export type ContractSummaryDto = {
  id: string;
  roomLabel: string;
  landlordName: string | null;
  tenantName: string | null;
  rentAmount: MoneyString;
  depositAmount: MoneyString;
  startDate: IsoDate;
  endDate: IsoDate;
  dueDay: number;
  status: ContractStatus;
  depositStatus: DepositStatus;
  disputeStatus: DisputeStatus;
  journeyStep: JourneyStep;
  myRole: "LANDLORD" | "TENANT";
};

export type DepositDto = {
  status: DepositStatus;
  paidAmount: MoneyString;
  refundAmount: MoneyString;
  deductedAmount: MoneyString;
  landlordRefundAmount: MoneyString | null;
  tenantRefundAmount: MoneyString | null;
};

export type RentPeriodDto = {
  periodNo: number;
  dueDate: IsoDate;
  amountDue: MoneyString;
  amountPaid: MoneyString;
  lateDays: number;
  lateFee: MoneyString;
  status: RentStatus;
};

export type DeductionDto = {
  id: string;
  amount: MoneyString;
  reasonText: string;
  status: DeductionStatus;
  createdAt: IsoDateTime;
};

export type ChargeKind = "ELECTRICITY" | "WATER" | "SERVICE" | "OTHER";
export type ChargeStatus = "UNPAID" | "PAID";

export type ChargeDto = {
  id: string;
  periodNo: number | null;
  kind: ChargeKind;
  amount: MoneyString;
  note: string | null;
  status: ChargeStatus;
  createdAt: IsoDateTime;
  paidAt: IsoDateTime | null;
};

export type DisputeDto = {
  status: DisputeStatus;
  openedBy: string | null;
  note: string | null;
  landlordAgreedAmount: MoneyString | null;
  tenantAgreedAmount: MoneyString | null;
};

export type ContractDetailDto = ContractSummaryDto & {
  lateFeeBpsPerDay: number;
  termsText: string;
  docHash: string | null;
  deposit: DepositDto;
  rentPeriods: RentPeriodDto[];
  deductions: DeductionDto[];
  dispute: DisputeDto | null;
  charges?: ChargeDto[];
};

export type PaymentDto = {
  id: string;
  contractId: string;
  kind: PaymentKind;
  periodNo: number | null;
  /** Số tiền theo hợp đồng, là số được ghi on-chain. */
  businessAmount: MoneyString;
  /** Số tiền thực thu qua cổng. Ở payOS demo là số tiền thử nghiệm. */
  expectedAmount: MoneyString;
  paidAmount: MoneyString;
  provider: PaymentProvider;
  status: PaymentStatus;
  isSimulated: boolean;
  qrData: string | null;
  checkoutUrl: string | null;
};

/** Chỉ chứa dữ liệu công khai được, dùng cho cả trang /bang-chung. */
export type OnchainTxDto = {
  id: string;
  contractId: string;
  action: string;
  payloadHash: string;
  status: OnchainTxStatus;
  txHash: string | null;
  explorerUrl: string | null;
  error: string | null;
  retryCount: number;
  createdAt: IsoDateTime;
};

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
};
