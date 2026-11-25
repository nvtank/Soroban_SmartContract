/**
 * Hợp đồng dữ liệu của bảng điều khiển quản trị (admin).
 * API (src/app/api/admin/**) trả đúng các kiểu này; giao diện (src/app/(admin)/**) chỉ đọc các kiểu này.
 * Đổi kiểu ở đây phải báo Manager vì nhiều agent cùng dùng.
 *
 * Nguyên tắc (docs/ADMIN_API.md): admin chỉ XEM và VẬN HÀNH. Không phân xử tranh chấp, không giải ngân,
 * không sửa số tiền hay trạng thái nghiệp vụ, không đăng nhập thay người dùng.
 * Số điện thoại luôn che bớt; tiền là số tiền nghiệp vụ trong bản demo (mô phỏng).
 */
import type { IsoDateTime, MoneyString, UserRole } from "@/domain/dto";
import type {
  ContractStatus,
  DepositStatus,
  DisputeStatus,
  OnchainTxStatus,
  PaymentStatus,
  RentStatus,
} from "@/domain/states";

/** Một điểm của chuỗi theo ngày. */
export type DailyPoint = { date: string /* YYYY-MM-DD */; value: number };
/** Một điểm của chuỗi theo phút (biểu đồ trực tiếp). */
export type MinutePoint = { at: IsoDateTime; value: number };

export type AdminKpis = {
  users: { total: number; landlords: number; tenants: number; newLast7d: number; activeLast24h: number };
  contracts: { total: number; byStatus: Record<ContractStatus, number> };
  deposits: { byStatus: Record<DepositStatus, number>; heldAmount: MoneyString /* mô phỏng */ };
  rent: {
    byStatus: Record<RentStatus, number>;
    overdueAmount: MoneyString;
    collectedLast30d: MoneyString;
  };
  disputes: { byStatus: Record<DisputeStatus, number> };
  payments: { byStatus: Record<PaymentStatus, number>; simulatedShare: number /* 0..1 */ };
  onchain: { byStatus: Record<OnchainTxStatus, number>; successRate: number /* 0..1, 30 ngày */ };
  recovery: { pending: number };
};

export type AdminOverviewDto = {
  kpis: AdminKpis;
  /** 30 ngày gần nhất, đủ 30 điểm (ngày không có dữ liệu = 0). */
  series: {
    newUsers: DailyPoint[];
    newContracts: DailyPoint[];
    paymentsAmount: DailyPoint[]; // VND, mô phỏng
    onchainConfirmed: DailyPoint[];
    onchainFailed: DailyPoint[];
    logins: DailyPoint[];
  };
  generatedAt: IsoDateTime;
};

export type AdminEventAction =
  | "LOGIN"
  | "LOGOUT"
  | "CONTRACT_CREATED"
  | "CONTRACT_CONFIRMED"
  | "PAYMENT_CREATED"
  | "PAYMENT_SETTLED"
  | "REFUND_REQUESTED"
  | "REFUND_APPROVED"
  | "DEDUCTION_PROPOSED"
  | "DEDUCTION_RESPONDED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "DUE_EXTENDED"
  | "ONCHAIN_CONFIRMED"
  | "ONCHAIN_FAILED"
  | "RECOVERY_REQUESTED"
  | "RECOVERY_APPROVED"
  | "ADMIN_ACTION"
  | "OTHER";

export type AdminEvent = {
  id: string;
  at: IsoDateTime;
  action: AdminEventAction;
  /** Tên hiển thị đã rút gọn, ví dụ "Trần T. Bình"; null với hệ thống. */
  actorLabel: string | null;
  actorRole: UserRole | "SYSTEM";
  actorId: string | null;
  target: {
    type: "contract" | "payment" | "onchain" | "user" | "recovery";
    id: string;
    label: string;
  } | null;
  /** Một câu mô tả ngắn tiếng Việt. */
  summary: string;
};

export type AdminLiveDto = {
  now: IsoDateTime;
  /** Người dùng có hoạt động trong 5 phút gần nhất. */
  activeUsers: number;
  /** 60 điểm, mỗi phút một điểm: số người dùng hoạt động trong phút đó. */
  activeSeries: MinutePoint[];
  /** 60 điểm, mỗi phút: số sự kiện. */
  eventSeries: MinutePoint[];
  /** Sự kiện mới nhất trước, tối đa 30. Dùng `since` để chỉ lấy sự kiện mới. */
  events: AdminEvent[];
  queue: { pending: number; submitted: number; failed: number };
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type AdminUserRow = {
  id: string;
  fullName: string | null;
  phoneMasked: string; // "090***0002"
  role: UserRole;
  createdAt: IsoDateTime;
  lastActiveAt: IsoDateTime | null;
  contractCount: number;
  hasPasskey: boolean;
  walletPublicKey: string | null; // địa chỉ công khai, không bao giờ có khóa bí mật
};

export type AdminUserDetailDto = AdminUserRow & {
  contracts: AdminContractRow[];
  recentEvents: AdminEvent[];
  activityByDay: DailyPoint[]; // 30 ngày
};

export type AdminContractRow = {
  id: string;
  roomLabel: string;
  status: ContractStatus;
  depositStatus: DepositStatus;
  disputeStatus: DisputeStatus;
  landlordLabel: string;
  tenantLabel: string | null;
  rentAmount: MoneyString;
  depositAmount: MoneyString;
  overduePeriods: number;
  onchain: { confirmed: number; total: number };
  createdAt: IsoDateTime;
};

export type AdminContractDetailDto = AdminContractRow & {
  periods: {
    periodNo: number;
    dueDate: string;
    amountDue: MoneyString;
    amountPaid: MoneyString;
    lateFee: MoneyString;
    status: RentStatus;
  }[];
  payments: AdminPaymentRow[];
  onchainTxs: AdminOnchainRow[];
  events: AdminEvent[];
};

export type AdminPaymentRow = {
  id: string;
  contractId: string;
  roomLabel: string;
  kind: "DEPOSIT" | "RENT";
  periodNo: number | null;
  expectedAmount: MoneyString;
  paidAmount: MoneyString;
  status: PaymentStatus;
  provider: string;
  isSimulated: boolean;
  createdAt: IsoDateTime;
  settledAt: IsoDateTime | null;
};

export type AdminOnchainRow = {
  id: string;
  contractId: string | null;
  roomLabel: string | null;
  action: string;
  status: OnchainTxStatus;
  txHash: string | null;
  explorerUrl: string | null;
  retryCount: number;
  error: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type AdminAuditRow = {
  id: string;
  at: IsoDateTime;
  actorLabel: string | null;
  actorRole: UserRole | "SYSTEM";
  action: string;
  entity: string;
  entityId: string | null;
  detail: string | null;
};

export type AdminRecoveryRow = {
  id: string;
  userId: string;
  userLabel: string;
  phoneMasked: string;
  status: string;
  createdAt: IsoDateTime;
};

export type AdminHealthDto = {
  checkedAt: IsoDateTime;
  database: { ok: boolean; latencyMs: number };
  stellar: {
    rpcOk: boolean;
    latestLedger: number | null;
    contractOk: boolean;
    contractId: string | null;
    platformBalanceXlm: number | null;
    oracleBalanceXlm: number | null;
    lowBalance: boolean;
    error: string | null;
  };
  queue: { pending: number; submitted: number; failed: number; oldestPendingSeconds: number | null };
  demoMode: boolean;
  paymentMode: string;
};

export type ListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  role?: string;
  sort?: string;
};
