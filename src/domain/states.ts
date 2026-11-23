/**
 * Nguồn sự thật duy nhất cho enum trạng thái và bảng chuyển trạng thái.
 * Thứ tự phần tử trong mỗi mảng là mã u32 on-chain, khớp 1-1 với
 * contracts/rentflow/src/types.rs. Không đổi thứ tự khi chưa được Manager duyệt.
 */

export const CONTRACT_STATUSES = ["PENDING_CONFIRMATION", "ACTIVE", "ENDED", "CANCELLED"] as const;
export const DEPOSIT_STATUSES = [
  "UNPAID",
  "RECORDED",
  "PENDING_REFUND",
  "PENDING_DISPUTE",
  "REFUNDED",
  "DEDUCTED",
] as const;
export const RENT_STATUSES = ["NOT_DUE", "AWAITING_PAYMENT", "PAID", "OVERDUE", "PARTIALLY_PAID"] as const;
export const DISPUTE_STATUSES = ["NONE", "AWAITING_CONFIRMATION", "IN_PROGRESS", "RESOLVED"] as const;

// Chỉ tồn tại off-chain.
export const PAYMENT_STATUSES = ["PENDING", "CONFIRMED", "FAILED", "UNDERPAID", "OVERPAID", "EXPIRED"] as const;
export const DEDUCTION_STATUSES = ["PROPOSED", "ACCEPTED", "REJECTED"] as const;
export const ONCHAIN_TX_STATUSES = ["PENDING", "SUBMITTED", "CONFIRMED", "FAILED"] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];
export type RentStatus = (typeof RENT_STATUSES)[number];
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DeductionStatus = (typeof DEDUCTION_STATUSES)[number];
export type OnchainTxStatus = (typeof ONCHAIN_TX_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  ACTIVE: "Đang hiệu lực",
  ENDED: "Đã kết thúc",
  CANCELLED: "Đã hủy",
};

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  UNPAID: "Chưa thanh toán",
  RECORDED: "Đã ghi nhận",
  PENDING_REFUND: "Chờ hoàn cọc",
  PENDING_DISPUTE: "Chờ xử lý tranh chấp",
  REFUNDED: "Đã hoàn trả",
  DEDUCTED: "Đã khấu trừ theo thỏa thuận",
};

export const RENT_STATUS_LABELS: Record<RentStatus, string> = {
  NOT_DUE: "Chưa đến hạn",
  AWAITING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  PARTIALLY_PAID: "Thanh toán một phần",
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  NONE: "Không có tranh chấp",
  AWAITING_CONFIRMATION: "Đang chờ xác nhận",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã thống nhất kết quả",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Đang chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  FAILED: "Thất bại",
  UNDERPAID: "Nộp thiếu",
  OVERPAID: "Nộp thừa",
  EXPIRED: "Đã hết hạn",
};

export const DEDUCTION_STATUS_LABELS: Record<DeductionStatus, string> = {
  PROPOSED: "Đang đề xuất",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
};

export const ONCHAIN_TX_STATUS_LABELS: Record<OnchainTxStatus, string> = {
  PENDING: "Đang ghi",
  SUBMITTED: "Đang ghi",
  CONFIRMED: "Đã ghi nhận",
  FAILED: "Thất bại",
};

type TransitionTable<S extends string> = Readonly<Record<S, readonly S[]>>;

export const CONTRACT_TRANSITIONS: TransitionTable<ContractStatus> = {
  PENDING_CONFIRMATION: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ENDED"],
  ENDED: [],
  CANCELLED: [],
};

export const DEPOSIT_TRANSITIONS: TransitionTable<DepositStatus> = {
  UNPAID: ["RECORDED"],
  RECORDED: ["PENDING_REFUND", "PENDING_DISPUTE"],
  PENDING_REFUND: ["REFUNDED", "DEDUCTED", "PENDING_DISPUTE"],
  PENDING_DISPUTE: ["REFUNDED", "DEDUCTED"],
  REFUNDED: [],
  DEDUCTED: [],
};

// Tự chuyển PARTIALLY_PAID (trả thêm một phần) và OVERDUE (cập nhật số ngày trễ) là hợp lệ.
export const RENT_TRANSITIONS: TransitionTable<RentStatus> = {
  NOT_DUE: ["AWAITING_PAYMENT"],
  AWAITING_PAYMENT: ["PAID", "PARTIALLY_PAID", "OVERDUE"],
  PARTIALLY_PAID: ["PARTIALLY_PAID", "PAID", "OVERDUE"],
  OVERDUE: ["OVERDUE", "PARTIALLY_PAID", "PAID", "AWAITING_PAYMENT"],
  PAID: [],
};

// AWAITING_CONFIRMATION: một bên đã gửi số tiền thống nhất, chờ bên còn lại.
// Hai số khác nhau thì quay lại IN_PROGRESS, hệ thống không tự kết luận.
export const DISPUTE_TRANSITIONS: TransitionTable<DisputeStatus> = {
  NONE: ["IN_PROGRESS"],
  IN_PROGRESS: ["AWAITING_CONFIRMATION"],
  AWAITING_CONFIRMATION: ["RESOLVED", "IN_PROGRESS"],
  RESOLVED: [],
};

export const PAYMENT_TRANSITIONS: TransitionTable<PaymentStatus> = {
  PENDING: ["CONFIRMED", "FAILED", "UNDERPAID", "OVERPAID", "EXPIRED"],
  UNDERPAID: ["CONFIRMED", "OVERPAID"],
  OVERPAID: [],
  CONFIRMED: [],
  FAILED: [],
  EXPIRED: [],
};

export const DEDUCTION_TRANSITIONS: TransitionTable<DeductionStatus> = {
  PROPOSED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
};

export const ONCHAIN_TX_TRANSITIONS: TransitionTable<OnchainTxStatus> = {
  PENDING: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["CONFIRMED", "FAILED"],
  FAILED: ["PENDING"],
  CONFIRMED: [],
};

export function canTransition<S extends string>(table: TransitionTable<S>, from: S, to: S): boolean {
  return table[from].includes(to);
}

export class InvalidTransitionError extends Error {
  readonly code = "INVALID_TRANSITION";

  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition<S extends string>(table: TransitionTable<S>, from: S, to: S): void {
  if (!canTransition(table, from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * Luật giải ngân: mọi code đổi trạng thái cọc phải đi qua hàm này.
 * Cọc đang tranh chấp chỉ được giải ngân khi tranh chấp đã RESOLVED.
 */
export function canTransitionDeposit(from: DepositStatus, to: DepositStatus, dispute: DisputeStatus): boolean {
  if (!canTransition(DEPOSIT_TRANSITIONS, from, to)) return false;
  if (to !== "REFUNDED" && to !== "DEDUCTED") return true;
  return from === "PENDING_DISPUTE" ? dispute === "RESOLVED" : dispute === "NONE";
}

export function assertDepositTransition(from: DepositStatus, to: DepositStatus, dispute: DisputeStatus): void {
  if (!canTransitionDeposit(from, to, dispute)) {
    throw new InvalidTransitionError(`${from} (dispute: ${dispute})`, to);
  }
}
