import type { JourneyStep } from "@/domain/dto";
import { Check, AlertTriangle, FileText, ShieldCheck, Calendar, KeyRound, AlertOctagon } from "lucide-react";

export type JourneyStepperProps = {
  current: JourneyStep;
  disputed?: boolean;
  compact?: boolean;
  className?: string;
};

type StepConfig = {
  id: JourneyStep;
  stepNumber: string;
  label: string;
  icon: typeof FileText;
};

const STEPS: readonly StepConfig[] = [
  { id: "SIGN", stepNumber: "01", label: "Ký hợp đồng", icon: FileText },
  { id: "DEPOSIT", stepNumber: "02", label: "Nạp cọc", icon: ShieldCheck },
  { id: "RENT", stepNumber: "03", label: "Thu tiền thuê", icon: Calendar },
  { id: "SETTLE", stepNumber: "04", label: "Hoàn cọc", icon: KeyRound },
  { id: "DISPUTE", stepNumber: "05", label: "Tranh chấp", icon: AlertOctagon },
];

const STEP_ORDER: Record<JourneyStep, number> = {
  SIGN: 0,
  DEPOSIT: 1,
  RENT: 2,
  SETTLE: 3,
  DISPUTE: 4,
};

export function JourneyStepper({ current, disputed = false, compact = false, className = "" }: JourneyStepperProps) {
  const currentIndex = STEP_ORDER[current] ?? 0;

  if (compact) {
    return (
      <nav aria-label="Tiến trình hợp đồng (rút gọn)" className={`flex items-center gap-1.5 ${className}`}>
        {STEPS.map((step, idx) => {
          const isCurrent = step.id === current;
          const isPast = idx < currentIndex && current !== "DISPUTE";
          const isDisputeStep = step.id === "DISPUTE";

          let badgeClass = "bg-line/30 text-ink/50";
          if (isDisputeStep && (isCurrent || disputed)) {
            badgeClass = "bg-brick text-paper font-bold";
          } else if (isCurrent) {
            badgeClass = "bg-primary text-paper font-bold ring-2 ring-primary/30";
          } else if (isPast) {
            badgeClass = "bg-primary/20 text-primary-strong font-medium";
          }

          return (
            <div
              key={step.id}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${badgeClass}`}
              title={`${step.stepNumber}: ${step.label}`}
            >
              <span>{step.stepNumber}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Hành trình hợp đồng 5 bước"
      className={`w-full rounded-2xl border border-line bg-surface/60 p-4 md:p-6 backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col gap-4">
        {disputed && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-brick/40 bg-brick/10 px-3.5 py-2 text-sm font-medium text-brick-ink"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-brick" />
            <span>Hợp đồng đang ở trạng thái Chờ xử lý tranh chấp. Tiền cọc được khóa an toàn trên Soroban.</span>
          </div>
        )}

        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5 md:gap-4">
          {STEPS.map((step, idx) => {
            const isCurrent = step.id === current;
            const isPast = idx < currentIndex && current !== "DISPUTE";
            const isDispute = step.id === "DISPUTE";
            const isDisputedActive = isDispute && (isCurrent || disputed);
            const StepIcon = step.icon;

            return (
              <li
                key={step.id}
                className={`relative flex flex-col rounded-xl border p-3 transition-all ${
                  isDisputedActive
                    ? "border-brick/40 bg-brick/10 text-brick-ink shadow-sm"
                    : isCurrent
                      ? "border-primary bg-paper text-ink shadow-sm ring-2 ring-primary/20"
                      : isPast
                        ? "border-line bg-paper/60 text-ink/75"
                        : "border-line/40 bg-surface/30 text-ink/40"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span className="font-mono font-semibold opacity-75">{step.stepNumber}</span>
                  {isPast ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary-strong">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : isCurrent ? (
                    <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                  ) : null}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <StepIcon
                    className={`h-4 w-4 shrink-0 ${
                      isDisputedActive
                        ? "text-brick"
                        : isCurrent
                          ? "text-primary-strong"
                          : isPast
                            ? "text-primary/70"
                            : "text-ink/30"
                    }`}
                  />
                  <span className="text-sm font-semibold leading-tight">{step.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
