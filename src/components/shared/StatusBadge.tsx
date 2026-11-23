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
  kind: "contract" | "deposit" | "rent" | "dispute" | "payment" | "deduction" | "onchain";
  status: string;
  className?: string;
};

export function StatusBadge({ kind, status, className = "" }: StatusBadgeProps) {
  let label = status;
  let colorClass = "bg-surface text-ink/70 border-line";

  switch (kind) {
    case "contract": {
      const typed = status as ContractStatus;
      label = CONTRACT_STATUS_LABELS[typed] ?? status;
      if (typed === "ACTIVE") colorClass = "bg-primary/10 text-primary-strong border-primary/30";
      else if (typed === "PENDING_CONFIRMATION") colorClass = "bg-amber/15 text-amber-ink border-amber/40";
      else if (typed === "ENDED") colorClass = "bg-surface text-ink/70 border-line";
      else if (typed === "CANCELLED") colorClass = "bg-brick/10 text-brick-ink border-brick/30";
      break;
    }
    case "deposit": {
      const typed = status as DepositStatus;
      label = DEPOSIT_STATUS_LABELS[typed] ?? status;
      if (typed === "RECORDED") colorClass = "bg-primary/10 text-primary-strong border-primary/30";
      else if (typed === "PENDING_REFUND") colorClass = "bg-amber/15 text-amber-ink border-amber/40";
      else if (typed === "PENDING_DISPUTE") colorClass = "bg-brick/15 text-brick-ink border-brick/40 font-semibold";
      else if (typed === "REFUNDED" || typed === "DEDUCTED") colorClass = "bg-surface text-ink/80 border-line";
      else if (typed === "UNPAID") colorClass = "bg-line/20 text-ink/60 border-line/40";
      break;
    }
    case "rent": {
      const typed = status as RentStatus;
      label = RENT_STATUS_LABELS[typed] ?? status;
      if (typed === "PAID") colorClass = "bg-primary/10 text-primary-strong border-primary/30";
      else if (typed === "AWAITING_PAYMENT") colorClass = "bg-amber/15 text-amber-ink border-amber/40";
      else if (typed === "OVERDUE") colorClass = "bg-brick/15 text-brick-ink border-brick/40 font-semibold";
      else if (typed === "PARTIALLY_PAID") colorClass = "bg-amber/20 text-amber-ink border-amber/40";
      else if (typed === "NOT_DUE") colorClass = "bg-surface text-ink/60 border-line/30";
      break;
    }
    case "dispute": {
      const typed = status as DisputeStatus;
      label = DISPUTE_STATUS_LABELS[typed] ?? status;
      if (typed === "IN_PROGRESS" || typed === "AWAITING_CONFIRMATION")
        colorClass = "bg-brick/15 text-brick-ink border-brick/40 font-semibold";
      else if (typed === "RESOLVED") colorClass = "bg-primary/10 text-primary-strong border-primary/30";
      else if (typed === "NONE") colorClass = "bg-surface text-ink/60 border-line/30";
      break;
    }
    case "payment": {
      const typed = status as PaymentStatus;
      label = PAYMENT_STATUS_LABELS[typed] ?? status;
      if (typed === "CONFIRMED") colorClass = "bg-primary/10 text-primary-strong border-primary/30";
      else if (typed === "PENDING") colorClass = "bg-amber/15 text-amber-ink border-amber/40";
      else if (typed === "FAILED" || typed === "EXPIRED") colorClass = "bg-brick/10 text-brick-ink border-brick/30";
      else if (typed === "UNDERPAID" || typed === "OVERPAID") colorClass = "bg-amber/20 text-amber-ink border-amber/40";
      break;
    }
    case "deduction": {
      const typed = status as DeductionStatus;
      label = DEDUCTION_STATUS_LABELS[typed] ?? status;
      if (typed === "ACCEPTED") colorClass = "bg-primary/10 text-primary-strong border-primary/30";
      else if (typed === "PROPOSED") colorClass = "bg-amber/15 text-amber-ink border-amber/40";
      else if (typed === "REJECTED") colorClass = "bg-brick/15 text-brick-ink border-brick/40";
      break;
    }
    case "onchain": {
      const typed = status as OnchainTxStatus;
      label = ONCHAIN_TX_STATUS_LABELS[typed] ?? status;
      if (typed === "CONFIRMED") colorClass = "bg-primary/15 text-primary-strong border-primary/30 font-semibold";
      else if (typed === "PENDING" || typed === "SUBMITTED")
        colorClass = "bg-amber/15 text-amber-ink border-amber/40 animate-pulse";
      else if (typed === "FAILED") colorClass = "bg-brick/15 text-brick-ink border-brick/40 font-semibold";
      break;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide ${colorClass} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      <span>{label}</span>
    </span>
  );
}
