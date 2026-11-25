"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChartTooltip } from "./ChartCard";
import { formatNumberVi, formatPercentVi } from "./format";
import { clampTooltipPosition, computeDonutSlices, polarToCartesian, type DonutInput } from "./math";
import { usePrefersReducedMotion } from "./use-chart-box";

export type DonutChartProps = {
  items: DonutInput[];
  centerLabel?: string;
  ariaLabel: string;
  size?: number;
};

export function DonutChart({
  items,
  centerLabel = "Tổng",
  ariaLabel,
  size = 172,
}: DonutChartProps) {
  const ringRef = useRef<SVGGElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const hasAnimated = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const strokeWidth = 22;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2 - 8;
  const circumference = 2 * Math.PI * radius;

  const total = useMemo(() => items.reduce((sum, i) => sum + Math.max(0, i.value), 0), [items]);
  const slices = useMemo(() => computeDonutSlices(items, circumference), [items, circumference]);
  const activeSlice = useMemo(
    () => slices.find((s) => s.id === activeId) ?? null,
    [slices, activeId],
  );

  // Quét vòng khi xuất hiện lần đầu
  useEffect(() => {
    if (hasAnimated.current || slices.length === 0) return;
    hasAnimated.current = true;
    if (reducedMotion || !ringRef.current) return;

    const circles = ringRef.current.querySelectorAll<SVGCircleElement>("circle[data-slice='true']");
    const ctx = gsap.context(() => {
      circles.forEach((circle, idx) => {
        const targetDash = Number(circle.dataset.dash ?? 0);
        gsap.fromTo(
          circle,
          { strokeDasharray: `0 ${circumference}` },
          {
            strokeDasharray: `${Math.max(0, targetDash - 1.5)} ${circumference}`,
            duration: 0.75,
            delay: idx * 0.06,
            ease: "power2.out",
          },
        );
      });
    }, ringRef);

    return () => ctx.revert();
  }, [slices.length, circumference, reducedMotion]);

  const tooltipPos = useMemo(() => {
    if (!activeSlice) return null;
    const anchor = polarToCartesian(cx, cy, radius + 6, activeSlice.midAngle);
    return clampTooltipPosition(anchor.x, anchor.y, 160, 62, size, size, 8);
  }, [activeSlice, cx, cy, radius, size]);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        onPointerLeave={() => setActiveId(null)}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
          className="block overflow-visible"
        >
          {/* Vòng nền mờ */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(20, 33, 61, 0.08)"
            strokeWidth={strokeWidth}
          />

          <g ref={ringRef} transform={`rotate(-90 ${cx} ${cy})`}>
            {slices.map((slice) => {
              const isActive = activeId === slice.id;
              // Đẩy lát đang hover nổi ra ngoài theo hướng góc giữa
              const rad = ((slice.midAngle - 90) * Math.PI) / 180;
              // Vì nhóm đã xoay -90 độ nên trục dịch chuyển cục bộ xoay theo +90 độ
              const popDist = isActive ? 5 : 0;
              const localAngle = (slice.midAngle * Math.PI) / 180;
              const dx = Math.cos(localAngle) * popDist;
              const dy = Math.sin(localAngle) * popDist;
              void rad;
              return (
                <circle
                  key={slice.id}
                  data-slice="true"
                  data-dash={slice.dashLength}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isActive ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={`${Math.max(0, slice.dashLength - 1.5)} ${circumference}`}
                  strokeDashoffset={slice.dashOffset}
                  style={{
                    transform: popDist ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` : undefined,
                    transition: reducedMotion ? undefined : "transform 180ms ease-out, stroke-width 180ms ease-out",
                    cursor: "pointer",
                  }}
                  opacity={activeId && !isActive ? 0.55 : 1}
                  onPointerEnter={() => setActiveId(slice.id)}
                  onPointerDown={() => setActiveId(slice.id)}
                />
              );
            })}
          </g>

          {/* Nhãn ở tâm vòng */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="tabular fill-ink text-xl font-bold"
          >
            {activeSlice ? formatNumberVi(activeSlice.value) : formatNumberVi(total)}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-ink/60 text-[11px] font-medium"
          >
            {activeSlice ? formatPercentVi(activeSlice.ratio, 0) : centerLabel}
          </text>
        </svg>

        {activeSlice && tooltipPos ? (
          <ChartTooltip
            left={tooltipPos.left}
            top={tooltipPos.top}
            title={activeSlice.label}
            rows={[
              {
                label: "Số lượng",
                value: `${formatNumberVi(activeSlice.value)} (${formatPercentVi(activeSlice.ratio, 1)})`,
                color: activeSlice.color,
              },
            ]}
          />
        ) : null}
      </div>

      {/* Chú thích có thể hover/chạm */}
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs">
        {items.map((item) => {
          const ratio = total > 0 ? item.value / total : 0;
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onPointerEnter={() => setActiveId(item.id)}
                onPointerLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(item.id)}
                onBlur={() => setActiveId(null)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1 text-left transition-colors ${
                  isActive ? "bg-surface text-ink" : "text-ink/80 hover:bg-surface/60"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="tabular shrink-0 font-semibold text-ink">
                  {formatNumberVi(item.value)}
                  <span className="ml-1 font-normal text-ink/55">
                    ({formatPercentVi(ratio, 0)})
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Trạng thái</th>
              <th scope="col">Số lượng</th>
              <th scope="col">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>{formatNumberVi(item.value)}</td>
                <td>{formatPercentVi(total > 0 ? item.value / total : 0, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
