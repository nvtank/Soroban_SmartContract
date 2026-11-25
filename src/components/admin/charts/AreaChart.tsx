"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChartTooltip } from "./ChartCard";
import { formatCompactVi, formatDateFullVi, formatDateShortVi, formatNumberVi } from "./format";
import {
  areaPath,
  clampTooltipPosition,
  linearScale,
  nearestIndex,
  niceScale,
  pickTickIndices,
  smoothPath,
  type Point2D,
} from "./math";
import { CHART_COLORS, useChartWidth, usePrefersReducedMotion } from "./use-chart-box";

export type AreaSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
};

export type AreaChartProps = {
  /** Nhãn trục X (ISO YYYY-MM-DD hoặc nhãn ngắn). */
  labels: string[];
  series: AreaSeries[];
  height?: number;
  ariaLabel: string;
  /** Định dạng giá trị trên trục Y. */
  formatY?: (v: number) => string;
  /** Định dạng giá trị trong tooltip và bảng sr-only. */
  formatValue?: (v: number) => string;
  /** Định dạng nhãn ngày trên trục X. */
  formatX?: (label: string) => string;
  /** Định dạng tiêu đề tooltip. */
  formatTooltipTitle?: (label: string) => string;
};

export function AreaChart({
  labels,
  series,
  height = 240,
  ariaLabel,
  formatY = formatCompactVi,
  formatValue = formatNumberVi,
  formatX = formatDateShortVi,
  formatTooltipTitle = formatDateFullVi,
}: AreaChartProps) {
  const uid = useId().replace(/:/g, "");
  const boxRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const areaRefs = useRef<(SVGPathElement | null)[]>([]);
  const width = useChartWidth(boxRef, 280);
  const reducedMotion = usePrefersReducedMotion();

  // Trạng thái giá trị đang hiển thị để tween mượt khi dữ liệu đổi
  const [rendered, setRendered] = useState<number[][]>(() => series.map((s) => [...s.values]));
  const prevRef = useRef<number[][]>(series.map((s) => [...s.values]));
  const hasAnimatedMount = useRef(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Tween mượt khi dữ liệu thay đổi
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

  // Vẽ dần đường biểu đồ khi xuất hiện lần đầu
  useEffect(() => {
    if (hasAnimatedMount.current) return;
    if (labels.length === 0 || series.length === 0) return;
    hasAnimatedMount.current = true;

    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      pathRefs.current.forEach((path, i) => {
        if (!path) return;
        const len = path.getTotalLength();
        if (!Number.isFinite(len) || len <= 0) return;
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 0.9,
            delay: i * 0.12,
            ease: "power2.out",
            onComplete: () => {
              path.style.strokeDasharray = "none";
              path.style.strokeDashoffset = "0";
            },
          },
        );
      });
      areaRefs.current.forEach((area, i) => {
        if (!area) return;
        gsap.fromTo(
          area,
          { opacity: 0 },
          { opacity: 1, duration: 0.7, delay: 0.2 + i * 0.12, ease: "power2.out" },
        );
      });
    }, boxRef);

    return () => ctx.revert();
  }, [labels.length, series.length, reducedMotion]);

  const pad = { top: 14, right: 14, bottom: 30, left: 52 };
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = Math.max(60, height - pad.top - pad.bottom);
  const count = labels.length;

  const scale = useMemo(() => {
    let maxV = 0;
    for (const s of series) {
      for (const v of s.values) if (v > maxV) maxV = v;
    }
    return niceScale(0, maxV, 4);
  }, [series]);

  const plotted = useMemo(() => {
    return series.map((s, si) => {
      const vals = rendered[si] ?? s.values;
      const pts: Point2D[] = vals.map((v, i) => ({
        x: count <= 1 ? pad.left + plotW / 2 : pad.left + (i / (count - 1)) * plotW,
        y: linearScale(v, scale.min, scale.max, pad.top + plotH, pad.top),
      }));
      return {
        ...s,
        points: pts,
        lineD: smoothPath(pts),
        areaD: areaPath(pts, pad.top + plotH),
      };
    });
  }, [series, rendered, count, pad.left, pad.top, plotW, plotH, scale.min, scale.max]);

  const xTickIndices = useMemo(
    () => pickTickIndices(count, width < 420 ? 4 : 6),
    [count, width],
  );

  const handlePointer = (clientX: number) => {
    const el = boxRef.current;
    if (!el || count === 0) return;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    setHoverIdx(nearestIndex(relX, count, pad.left, plotW));
  };

  const activeX =
    hoverIdx !== null && count > 0
      ? count === 1
        ? pad.left + plotW / 2
        : pad.left + (hoverIdx / (count - 1)) * plotW
      : null;

  const activeY =
    hoverIdx !== null && plotted[0]?.points[hoverIdx]
      ? plotted[0].points[hoverIdx].y
      : pad.top + plotH / 2;

  const tooltipPos =
    hoverIdx !== null && activeX !== null
      ? clampTooltipPosition(activeX, activeY, 185, 42 + series.length * 22, width, height)
      : null;

  return (
    <div className="min-w-0">
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink/75">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
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
          <defs>
            {series.map((s, i) => (
              <linearGradient
                key={s.id}
                id={`area-grad-${uid}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>

          {/* Lưới ngang & nhãn trục Y */}
          {scale.ticks.map((tick) => {
            const y = linearScale(tick, scale.min, scale.max, pad.top + plotH, pad.top);
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

          {/* Nhãn trục X */}
          {xTickIndices.map((idx) => {
            const x = count <= 1 ? pad.left + plotW / 2 : pad.left + (idx / (count - 1)) * plotW;
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

          {/* Vùng gradient và đường cong */}
          {plotted.map((s, i) => (
            <g key={s.id}>
              <path
                ref={(el) => {
                  areaRefs.current[i] = el;
                }}
                d={s.areaD}
                fill={`url(#area-grad-${uid}-${i})`}
              />
              <path
                ref={(el) => {
                  pathRefs.current[i] = el;
                }}
                d={s.lineD}
                fill="none"
                stroke={s.color}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Đường gióng dọc và chấm điểm khi rê chuột */}
          {hoverIdx !== null && activeX !== null ? (
            <g pointerEvents="none">
              <line
                x1={activeX}
                y1={pad.top}
                x2={activeX}
                y2={pad.top + plotH}
                stroke={CHART_COLORS.inkMuted}
                strokeDasharray="3 3"
              />
              {plotted.map((s) => {
                const pt = s.points[hoverIdx];
                if (!pt) return null;
                return (
                  <g key={s.id}>
                    <circle cx={pt.x} cy={pt.y} r={6} fill={s.color} fillOpacity={0.2} />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={3.5}
                      fill="var(--paper, #fbf8f3)"
                      stroke={s.color}
                      strokeWidth={2.2}
                    />
                  </g>
                );
              })}
            </g>
          ) : null}
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
