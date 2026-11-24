import {
  CONTRACT_STATUS_LABELS,
  DEPOSIT_STATUS_LABELS,
  RENT_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  DEDUCTION_STATUS_LABELS,
  ONCHAIN_TX_STATUS_LABELS,
  type ContractStatus,
  type DepositStatus,
  type RentStatus,
  type DisputeStatus,
  type PaymentStatus,
  type DeductionStatus,
  type OnchainTxStatus,
} from "@/domain/states";

export type StatusBadgeProps = {
  kind: "contract" | "deposit" | "rent" | "dispute" | "payment" | "deduction" | "onchain" | "charge";
  status: string;
  className?: string;
  dataTour?: string;
};

export function StatusBadge({ kind, status, className = "", dataTour }: StatusBadgeProps) {
  let label = status;
  let colorClass = "bg-surface text-ink/75 border-line";

  switch (kind) {
    case "contract": {
      const typed = status as ContractStatus;
      label = CONTRACT_STATUS_LABELS[typed] ?? status;
      if (typed === "ACTIVE") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "PENDING_CONFIRMATION") colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      else if (typed === "ENDED") colorClass = "bg-surface text-ink/70 border-line";
      else if (typed === "CANCELLED") colorClass = "bg-brick/12 text-brick-ink border-brick/30";
      break;
    }
    case "deposit": {
      const typed = status as DepositStatus;
      label = DEPOSIT_STATUS_LABELS[typed] ?? status;
      if (typed === "RECORDED") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "PENDING_REFUND") colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      else if (typed === "PENDING_DISPUTE") colorClass = "bg-brick/15 text-brick-ink border-brick/35";
      else if (typed === "REFUNDED" || typed === "DEDUCTED") colorClass = "bg-surface text-ink/80 border-line";
      else if (typed === "UNPAID") colorClass = "bg-amber/15 text-amber-ink border-amber/30";
      break;
    }
    case "rent": {
      const typed = status as RentStatus;
      label = RENT_STATUS_LABELS[typed] ?? status;
      if (typed === "PAID") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "AWAITING_PAYMENT") colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      else if (typed === "OVERDUE") colorClass = "bg-brick/15 text-brick-ink border-brick/35";
      else if (typed === "PARTIALLY_PAID") colorClass = "bg-amber/20 text-amber-ink border-amber/35";
      else if (typed === "NOT_DUE") colorClass = "bg-surface text-ink/60 border-line";
      break;
    }
    case "dispute": {
      const typed = status as DisputeStatus;
      label = DISPUTE_STATUS_LABELS[typed] ?? status;
      if (typed === "IN_PROGRESS" || typed === "AWAITING_CONFIRMATION")
        colorClass = "bg-brick/15 text-brick-ink border-brick/35";
      else if (typed === "RESOLVED") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "NONE") colorClass = "bg-surface text-ink/60 border-line";
      break;
    }
    case "payment": {
      const typed = status as PaymentStatus;
      label = PAYMENT_STATUS_LABELS[typed] ?? status;
      if (typed === "CONFIRMED") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "PENDING") colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      else if (typed === "FAILED" || typed === "EXPIRED") colorClass = "bg-brick/12 text-brick-ink border-brick/30";
      else if (typed === "UNDERPAID" || typed === "OVERPAID") colorClass = "bg-amber/20 text-amber-ink border-amber/35";
      break;
    }
    case "deduction": {
      const typed = status as DeductionStatus;
      label = DEDUCTION_STATUS_LABELS[typed] ?? status;
      if (typed === "ACCEPTED") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "PROPOSED") colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      else if (typed === "REJECTED") colorClass = "bg-brick/15 text-brick-ink border-brick/35";
      break;
    }
    case "onchain": {
      const typed = status as OnchainTxStatus;
      label = ONCHAIN_TX_STATUS_LABELS[typed] ?? status;
      if (typed === "CONFIRMED") colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      else if (typed === "PENDING" || typed === "SUBMITTED")
        colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      else if (typed === "FAILED") colorClass = "bg-brick/15 text-brick-ink border-brick/35";
      break;
    }
    case "charge": {
      if (status === "PAID") {
        label = "Đã thanh toán";
        colorClass = "bg-primary/12 text-primary-strong border-primary/25";
      } else {
        label = "Chưa thanh toán";
        colorClass = "bg-amber/18 text-amber-ink border-amber/35";
      }
      break;
    }
  }

  return (
    <span
      data-tour={dataTour}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorClass} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Một viên trạng thái chính duy nhất đại diện cho tình trạng hiện tại của hợp đồng
 * (tránh lặp 2-3 huy hiệu cạnh nhau trên thẻ hoặc tiêu đề).
 */
export function resolvePrimaryContractBadge(contract: {
  status: ContractStatus;
  depositStatus: DepositStatus;
  disputeStatus: DisputeStatus;
}): { kind: "contract" | "deposit"; status: string } {
  if (
    contract.depositStatus === "PENDING_DISPUTE" ||
    (contract.disputeStatus !== "NONE" && contract.disputeStatus !== "RESOLVED")
  ) {
    return { kind: "deposit", status: "PENDING_DISPUTE" };
  }
  if (contract.depositStatus === "REFUNDED") {
    return { kind: "deposit", status: "REFUNDED" };
  }
  if (contract.depositStatus === "DEDUCTED") {
    return { kind: "deposit", status: "DEDUCTED" };
  }
  return { kind: "contract", status: contract.status };
}
