"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChartTooltip } from "./ChartCard";
import { formatCompactVi, formatDateFullVi, formatDateShortVi, formatNumberVi } from "./format";
import { clampTooltipPosition, linearScale, niceScale, pickTickIndices } from "./math";
import { CHART_COLORS, useChartWidth, usePrefersReducedMotion } from "./use-chart-box";

export type BarSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
};

export type BarChartProps = {
  labels: string[];
  series: BarSeries[];
  stacked?: boolean;
  height?: number;
  ariaLabel: string;
  formatY?: (v: number) => string;
  formatValue?: (v: number) => string;
  formatX?: (label: string) => string;
  formatTooltipTitle?: (label: string) => string;
};

export function BarChart({
  labels,
  series,
  stacked = false,
  height = 240,
  ariaLabel,
  formatY = formatCompactVi,
  formatValue = formatNumberVi,
  formatX = formatDateShortVi,
  formatTooltipTitle = formatDateFullVi,
}: BarChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const barsGroupRef = useRef<SVGGElement>(null);
  const width = useChartWidth(boxRef, 280);
  const reducedMotion = usePrefersReducedMotion();

  const [rendered, setRendered] = useState<number[][]>(() => series.map((s) => [...s.values]));
  const prevRef = useRef<number[][]>(series.map((s) => [...s.values]));
  const hasAnimatedMount = useRef(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Tween mượt khi dữ liệu đổi
  useEffect(() => {
    const target = series.map((s) => [...s.values]);
    const prev = prevRef.current;
    const sameShape =
      prev.length === target.length && prev.every((arr, i) => arr.length === target[i].length);

    if (reducedMotion || !sameShape) {
      prevRef.current = target;
      const frame = requestAnimationFrame(() => setRendered(target));
      return () => cancelAnimationFrame(frame);
    }

    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        const t = proxy.t;
        const next = target.map((arr, si) =>
          arr.map((v, pi) => prev[si][pi] + (v - prev[si][pi]) * t),
        );
        setRendered(next);
      },
      onComplete: () => {
        prevRef.current = target;
      },
    });
    return () => {
      tween.kill();
    };
  }, [series, reducedMotion]);

  // Cột mọc lên khi xuất hiện lần đầu
  useEffect(() => {
    if (hasAnimatedMount.current || labels.length === 0) return;
    hasAnimatedMount.current = true;
    if (reducedMotion || !barsGroupRef.current) return;

    const rects = barsGroupRef.current.querySelectorAll("rect[data-bar='true']");
    if (rects.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rects,
        { scaleY: 0, transformOrigin: "bottom center" },
        {
          scaleY: 1,
          duration: 0.6,
          stagger: Math.min(0.02, 0.45 / rects.length),
          ease: "power2.out",
          clearProps: "transform",
        },
      );
    }, barsGroupRef);

    return () => ctx.revert();
  }, [labels.length, reducedMotion]);

  const pad = { top: 14, right: 12, bottom: 30, left: 46 };
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = Math.max(60, height - pad.top - pad.bottom);
  const count = labels.length;
  const baselineY = pad.top + plotH;

  const scale = useMemo(() => {
    let maxV = 0;
    for (let i = 0; i < count; i++) {
      if (stacked) {
        let sum = 0;
        for (const s of series) sum += s.values[i] ?? 0;
        if (sum > maxV) maxV = sum;
      } else {
        for (const s of series) {
          const v = s.values[i] ?? 0;
          if (v > maxV) maxV = v;
        }
      }
    }
    return niceScale(0, maxV, 4);
  }, [series, count, stacked]);

  const slotW = count > 0 ? plotW / count : plotW;
  const barGap = Math.max(2, Math.min(6, slotW * 0.25));
  const groupW = Math.max(3, slotW - barGap);

  const xTickIndices = useMemo(
    () => pickTickIndices(count, width < 420 ? 4 : 6),
    [count, width],
  );

  const handlePointer = (clientX: number) => {
    const el = boxRef.current;
    if (!el || count === 0) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left - pad.left;
    const idx = Math.floor(relX / slotW);
    setHoverIdx(Math.max(0, Math.min(count - 1, idx)));
  };

  const activeCenterX = hoverIdx !== null ? pad.left + (hoverIdx + 0.5) * slotW : null;
  const tooltipPos =
    hoverIdx !== null && activeCenterX !== null
      ? clampTooltipPosition(
          activeCenterX,
          pad.top + plotH * 0.35,
          185,
          42 + series.length * 22,
          width,
          height,
        )
      : null;

  return (
    <div className="min-w-0">
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink/75">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div
        ref={boxRef}
        className="relative w-full select-none"
        style={{ height }}
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="block max-w-full overflow-hidden"
        >
          {/* Lưới ngang & trục Y */}
          {scale.ticks.map((tick) => {
            const y = linearScale(tick, scale.min, scale.max, baselineY, pad.top);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  stroke={CHART_COLORS.grid}
                  strokeDasharray={tick === 0 ? undefined : "3 4"}
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="tabular fill-ink/55 text-[11px]"
                >
                  {formatY(tick)}
                </text>
              </g>
            );
          })}

          {/* Nền cột đang hover */}
          {hoverIdx !== null ? (
            <rect
              x={pad.left + hoverIdx * slotW}
              y={pad.top}
              width={slotW}
              height={plotH}
              rx={6}
              fill="rgba(20, 33, 61, 0.05)"
              pointerEvents="none"
            />
          ) : null}

          {/* Các cột dữ liệu */}
          <g ref={barsGroupRef}>
            {labels.map((label, i) => {
              const x0 = pad.left + i * slotW + barGap / 2;
              const isHovered = hoverIdx === i;

              if (stacked) {
                let acc = 0;
                return (
                  <g key={label}>
                    {series.map((s, si) => {
                      const val = Math.max(0, rendered[si]?.[i] ?? s.values[i] ?? 0);
                      const yBottom = linearScale(acc, scale.min, scale.max, baselineY, pad.top);
                      acc += val;
                      const yTop = linearScale(acc, scale.min, scale.max, baselineY, pad.top);
                      const h = Math.max(0, yBottom - yTop);
                      if (h <= 0.1) return null;
                      return (
                        <rect
                          key={s.id}
                          data-bar="true"
                          x={x0}
                          y={yTop}
                          width={groupW}
                          height={h}
                          rx={si === series.length - 1 ? Math.min(4, groupW / 2) : 1}
                          fill={s.color}
                          fillOpacity={hoverIdx === null || isHovered ? 0.92 : 0.52}
                        />
                      );
                    })}
                  </g>
                );
              }

              const subW = Math.max(2, groupW / Math.max(1, series.length));
              return (
                <g key={label}>
                  {series.map((s, si) => {
                    const val = Math.max(0, rendered[si]?.[i] ?? s.values[i] ?? 0);
                    const yTop = linearScale(val, scale.min, scale.max, baselineY, pad.top);
                    const h = Math.max(0, baselineY - yTop);
                    if (h <= 0.1) return null;
                    return (
                      <rect
                        key={s.id}
                        data-bar="true"
                        x={x0 + si * subW}
                        y={yTop}
                        width={Math.max(2, subW - (series.length > 1 ? 1.5 : 0))}
                        height={h}
                        rx={Math.min(4, subW / 2)}
                        fill={s.color}
                        fillOpacity={hoverIdx === null || isHovered ? 0.92 : 0.52}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* Nhãn trục X */}
          {xTickIndices.map((idx) => {
            const x = pad.left + (idx + 0.5) * slotW;
            return (
              <text
                key={idx}
                x={x}
                y={height - 8}
                textAnchor={idx === 0 ? "start" : idx === count - 1 ? "end" : "middle"}
                className="tabular fill-ink/55 text-[11px]"
              >
                {formatX(labels[idx])}
              </text>
            );
          })}
        </svg>

        {hoverIdx !== null && tooltipPos ? (
          <ChartTooltip
            left={tooltipPos.left}
            top={tooltipPos.top}
            title={formatTooltipTitle(labels[hoverIdx])}
            rows={series.map((s) => ({
              label: s.label,
              value: formatValue(s.values[hoverIdx] ?? 0),
              color: s.color,
            }))}
          />
        ) : null}
      </div>

      {/* Bảng dữ liệu ẩn cho trình đọc màn hình */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Ngày</th>
              {series.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, idx) => (
              <tr key={label}>
                <td>{formatTooltipTitle(label)}</td>
                {series.map((s) => (
                  <td key={s.id}>{formatValue(s.values[idx] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
