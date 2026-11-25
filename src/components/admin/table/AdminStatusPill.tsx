import { StatusBadge, type StatusBadgeProps } from "@/components/shared";
import type { UserRole } from "@/domain/dto";

export type AdminStatusPillProps =
  | StatusBadgeProps
  | { kind: "role"; status: UserRole | "SYSTEM"; className?: string }
  | { kind: "passkey"; enabled: boolean; className?: string }
  | { kind: "paymentKind"; value: "DEPOSIT" | "RENT"; className?: string }
  | { kind: "provider"; isSimulated: boolean; provider: string; className?: string };

export function AdminStatusPill(props: AdminStatusPillProps) {
  if (props.kind === "role") {
    let label = "Người thuê";
    let colorClass = "bg-surface text-ink/80 border-line";
    if (props.status === "LANDLORD") {
      label = "Chủ nhà";
      colorClass = "bg-primary/12 text-primary-strong border-primary/25";
    } else if (props.status === "ADMIN_DEMO") {
      label = "Quản trị";
      colorClass = "bg-amber/18 text-amber-ink border-amber/35";
    } else if (props.status === "SYSTEM") {
      label = "Hệ thống";
      colorClass = "bg-surface text-ink/65 border-line";
    }
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorClass} ${props.className ?? ""}`}
      >
        {label}
      </span>
    );
  }

  if (props.kind === "passkey") {
    const colorClass = props.enabled
      ? "bg-primary/12 text-primary-strong border-primary/25"
      : "bg-surface text-ink/55 border-line";
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorClass} ${props.className ?? ""}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" aria-hidden="true" />
        <span>{props.enabled ? "Có Passkey" : "Chưa bật"}</span>
      </span>
    );
  }

  if (props.kind === "paymentKind") {
    const isDeposit = props.value === "DEPOSIT";
    const colorClass = isDeposit
      ? "bg-amber/15 text-amber-ink border-amber/35"
      : "bg-primary/10 text-primary-strong border-primary/25";
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorClass} ${props.className ?? ""}`}
      >
        {isDeposit ? "Tiền cọc" : "Tiền thuê"}
      </span>
    );
  }

  if (props.kind === "provider") {
    const label = props.isSimulated ? "Mô phỏng" : props.provider || "payOS";
    const colorClass = props.isSimulated
      ? "border-dashed border-amber-ink/40 bg-amber/15 text-amber-ink"
      : "border-primary/25 bg-primary/10 text-primary-strong";
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorClass} ${props.className ?? ""}`}
      >
        {label}
      </span>
    );
  }

  return <StatusBadge {...props} />;
}
