"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { formatNumberVi } from "./format";
import { Sparkline } from "./Sparkline";
import { CHART_COLORS, usePrefersReducedMotion } from "./use-chart-box";

export type KpiTone = "primary" | "amber" | "brick" | "neutral";

export type KpiCardProps = {
  title: string;
  value: number;
  /** Hàm định dạng số hiển thị (mặc định số nguyên kiểu Việt Nam). */
  formatValue?: (v: number) => string;
  subtitle?: string;
  /** Phần trăm thay đổi so với kỳ trước (vd: 12.4 hoặc -5.2). */
  deltaPercent?: number | null;
  sparkline?: number[];
  sparklineLabel?: string;
  tone?: KpiTone;
  className?: string;
};

const TONE_COLOR: Record<KpiTone, string> = {
  primary: CHART_COLORS.primary,
  amber: CHART_COLORS.amber,
  brick: CHART_COLORS.brick,
  neutral: CHART_COLORS.ink,
};

export function KpiCard({
  title,
  value,
  formatValue = formatNumberVi,
  subtitle,
  deltaPercent,
  sparkline,
  sparklineLabel,
  tone = "primary",
  className = "",
}: KpiCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }

    const proxy = { n: from };
    const tween = gsap.to(proxy, {
      n: value,
      duration: 0.85,
      ease: "power2.out",
      onUpdate: () => setDisplay(proxy.n),
    });
    return () => {
      tween.kill();
    };
  }, [value, reducedMotion]);

  const deltaPositive = typeof deltaPercent === "number" && deltaPercent > 0;
  const deltaNegative = typeof deltaPercent === "number" && deltaPercent < 0;

  return (
    <article
      className={`flex min-w-0 flex-col justify-between rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-[0_12px_32px_-24px_rgb(20_33_61/0.22)] ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink/70">{title}</p>
        {typeof deltaPercent === "number" ? (
          <span
            className={`tabular inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              deltaPositive
                ? "bg-primary/12 text-primary-strong"
                : deltaNegative
                  ? "bg-brick/12 text-brick-ink"
                  : "bg-surface text-ink/70"
            }`}
          >
            {deltaPositive ? "+" : ""}
            {deltaPercent.toLocaleString("vi-VN", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 0,
            })}
            %
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="tabular truncate text-2xl font-bold tracking-tight text-ink sm:text-[1.65rem]">
            {formatValue(display)}
          </div>
          {subtitle ? (
            <p className="mt-1 line-clamp-1 text-xs text-ink/65">{subtitle}</p>
          ) : null}
        </div>

        {sparkline && sparkline.length > 1 ? (
          <Sparkline
            values={sparkline}
            color={TONE_COLOR[tone]}
            width={84}
            height={32}
            ariaLabel={sparklineLabel ?? `Xu hướng ${title}`}
          />
        ) : null}
      </div>
    </article>
  );
}
