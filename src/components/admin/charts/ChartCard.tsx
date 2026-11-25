"use client";

import type { ReactNode } from "react";

export type ChartCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Khung thẻ chuẩn cho các biểu đồ trên trang quản trị. */
export function ChartCard({ title, subtitle, action, children, className = "" }: ChartCardProps) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-[0_12px_32px_-24px_rgb(20_33_61/0.22)] sm:p-6 ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-ink/65">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

export type ChartTooltipProps = {
  left: number;
  top: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
};

/** Hộp tooltip nổi khi rê chuột hoặc chạm vào biểu đồ. */
export function ChartTooltip({ left, top, title, rows }: ChartTooltipProps) {
  return (
    <div
      role="tooltip"
      data-chart-tooltip="true"
      style={{ transform: `translate3d(${left}px, ${top}px, 0)` }}
      className="pointer-events-none absolute top-0 left-0 z-20 min-w-[148px] max-w-[230px] rounded-2xl border border-line bg-paper/95 px-3.5 py-2.5 text-xs text-ink shadow-[0_14px_30px_-16px_rgb(20_33_61/0.32)] backdrop-blur-sm"
    >
      <div className="mb-1.5 font-semibold text-ink/80">{title}</div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-ink/75">
              {row.color ? (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
              ) : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
