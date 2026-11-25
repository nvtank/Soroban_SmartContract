"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import type { MinutePoint } from "@/domain/admin/dto";
import { ChartTooltip } from "./ChartCard";
import { formatCompactVi, formatNumberVi, formatTimeVi } from "./format";
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

export type LiveLineChartProps = {
  points: MinutePoint[];
  color?: string;
  height?: number;
  ariaLabel: string;
  valueLabel: string;
  unitSuffix?: string;
};

export function LiveLineChart({
  points,
  color = CHART_COLORS.primary,
  height = 220,
  ariaLabel,
  valueLabel,
  unitSuffix = "",
}: LiveLineChartProps) {
  const uid = useId().replace(/:/g, "");
  const boxRef = useRef<HTMLDivElement>(null);
  const slideGroupRef = useRef<SVGGElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotGroupRef = useRef<SVGGElement>(null);
  const width = useChartWidth(boxRef, 280);
  const reducedMotion = usePrefersReducedMotion();

  const prevValuesRef = useRef<number[]>(points.map((p) => p.value));
  const lastTimestampRef = useRef<string | null>(points[points.length - 1]?.at ?? null);
  const hasDrawnRef = useRef(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const pad = { top: 14, right: 16, bottom: 28, left: 44 };
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = Math.max(60, height - pad.top - pad.bottom);
  const count = points.length;

  const scale = useMemo(() => {
    let maxV = 0;
    for (const p of points) if (p.value > maxV) maxV = p.value;
    return niceScale(0, Math.max(4, maxV), 4);
  }, [points]);

  // Vẽ dần khi xuất hiện lần đầu
  useEffect(() => {
    const path = pathRef.current;
    if (hasDrawnRef.current || count === 0 || reducedMotion || !path) return;

    const len = path.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return;
    const tween = gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      {
        strokeDashoffset: 0,
        duration: 0.85,
        ease: "power2.out",
        onComplete: () => {
          hasDrawnRef.current = true;
          path.style.strokeDasharray = "none";
          path.style.strokeDashoffset = "0";
        },
      },
    );
    return () => {
      tween.kill();
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
    };
  }, [count, reducedMotion]);

  // Chấm nhấp nháy ở điểm cuối
  useEffect(() => {
    if (reducedMotion || !pulseRef.current) return;
    const tween = gsap.fromTo(
      pulseRef.current,
      { scale: 1, opacity: 0.65, transformOrigin: "center center" },
      {
        scale: 2.4,
        opacity: 0,
        duration: 1.5,
        repeat: -1,
        ease: "power1.out",
      },
    );
    return () => {
      tween.kill();
    };
  }, [reducedMotion, count]);

  // Trượt sang trái khi có phút mới và cập nhật thuộc tính SVG trực tiếp qua GSAP (không re-render React mỗi frame)
  useEffect(() => {
    const target = points.map((p) => p.value);
    const prev = prevValuesRef.current;
    const latestAt = points[points.length - 1]?.at ?? null;
    const shifted = Boolean(lastTimestampRef.current && latestAt && latestAt !== lastTimestampRef.current);
    lastTimestampRef.current = latestAt;

    if (reducedMotion || prev.length !== target.length || count === 0) {
      prevValuesRef.current = target;
      return;
    }

    let slideTween: gsap.core.Tween | null = null;
    if (shifted && slideGroupRef.current && count > 1) {
      const stepW = plotW / (count - 1);
      slideTween = gsap.fromTo(
        slideGroupRef.current,
        { x: stepW },
        { x: 0, duration: 0.45, ease: "power2.out", clearProps: "transform" },
      );
    }

    const proxy = { t: 0 };
    const valueTween = gsap.to(proxy, {
      t: 1,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => {
        const t = proxy.t;
        const pts: Point2D[] = target.map((v, i) => {
          const val = prev[i] + (v - prev[i]) * t;
          return {
            x: count <= 1 ? pad.left + plotW / 2 : pad.left + (i / (count - 1)) * plotW,
            y: linearScale(val, scale.min, scale.max, pad.top + plotH, pad.top),
          };
        });
        if (pathRef.current) pathRef.current.setAttribute("d", smoothPath(pts));
        if (areaRef.current) areaRef.current.setAttribute("d", areaPath(pts, pad.top + plotH));
        const last = pts[pts.length - 1];
        if (last && dotGroupRef.current) {
          dotGroupRef.current.setAttribute("transform", `translate(${last.x.toFixed(2)}, ${last.y.toFixed(2)})`);
        }
      },
      onComplete: () => {
        prevValuesRef.current = target;
      },
    });

    return () => {
      slideTween?.kill();
      valueTween.kill();
    };
  }, [points, count, pad.left, pad.top, plotW, plotH, scale.min, scale.max, reducedMotion]);

  const coords: Point2D[] = useMemo(() => {
    return points.map((p, i) => ({
      x: count <= 1 ? pad.left + plotW / 2 : pad.left + (i / (count - 1)) * plotW,
      y: linearScale(p.value, scale.min, scale.max, pad.top + plotH, pad.top),
    }));
  }, [points, count, pad.left, pad.top, plotW, plotH, scale.min, scale.max]);

  const lineD = useMemo(() => smoothPath(coords), [coords]);
  const areaD = useMemo(() => areaPath(coords, pad.top + plotH), [coords, pad.top, plotH]);
  const lastPt = coords[coords.length - 1] ?? null;

  const xTickIndices = useMemo(
    () => pickTickIndices(count, width < 420 ? 4 : 6),
    [count, width],
  );

  const handlePointer = (clientX: number) => {
    const el = boxRef.current;
    if (!el || count === 0) return;
    const rect = el.getBoundingClientRect();
    setHoverIdx(nearestIndex(clientX - rect.left, count, pad.left, plotW));
  };

  const activePt = hoverIdx !== null ? coords[hoverIdx] : null;
  const tooltipPos =
    hoverIdx !== null && activePt
      ? clampTooltipPosition(activePt.x, activePt.y, 172, 64, width, height)
      : null;

  return (
    <div className="min-w-0">
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
            <linearGradient id={`live-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
            <clipPath id={`live-clip-${uid}`}>
              <rect x={pad.left - 4} y={pad.top - 8} width={plotW + 16} height={plotH + 16} />
            </clipPath>
          </defs>

          {/* Lưới ngang & trục Y */}
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
                  {formatCompactVi(tick)}
                </text>
              </g>
            );
          })}

          {/* Nhãn trục X (HH:mm) */}
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
                {formatTimeVi(points[idx].at)}
              </text>
            );
          })}

          {/* Nhóm trượt sang trái khi có điểm mới */}
          <g clipPath={`url(#live-clip-${uid})`}>
            <g ref={slideGroupRef}>
              {areaD ? <path ref={areaRef} d={areaD} fill={`url(#live-grad-${uid})`} /> : null}
              {lineD ? (
                <path
                  ref={pathRef}
                  d={lineD}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {/* Chấm nhấp nháy ở điểm mới nhất */}
              {lastPt ? (
                <g
                  ref={dotGroupRef}
                  transform={`translate(${lastPt.x.toFixed(2)}, ${lastPt.y.toFixed(2)})`}
                  pointerEvents="none"
                >
                  <circle
                    ref={pulseRef}
                    cx={0}
                    cy={0}
                    r={5}
                    fill={color}
                    opacity={reducedMotion ? 0.25 : 0.6}
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={4}
                    fill="var(--paper, #fbf8f3)"
                    stroke={color}
                    strokeWidth={2.4}
                  />
                </g>
              ) : null}
            </g>
          </g>

          {/* Đường gióng dọc khi rê chuột */}
          {hoverIdx !== null && activePt ? (
            <g pointerEvents="none">
              <line
                x1={activePt.x}
                y1={pad.top}
                x2={activePt.x}
                y2={pad.top + plotH}
                stroke={CHART_COLORS.inkMuted}
                strokeDasharray="3 3"
              />
              <circle
                cx={activePt.x}
                cy={activePt.y}
                r={4}
                fill="var(--paper, #fbf8f3)"
                stroke={color}
                strokeWidth={2.4}
              />
            </g>
          ) : null}
        </svg>

        {hoverIdx !== null && tooltipPos ? (
          <ChartTooltip
            left={tooltipPos.left}
            top={tooltipPos.top}
            title={`Lúc ${formatTimeVi(points[hoverIdx].at)}`}
            rows={[
              {
                label: valueLabel,
                value: `${formatNumberVi(points[hoverIdx].value)}${unitSuffix ? ` ${unitSuffix}` : ""}`,
                color,
              },
            ]}
          />
        ) : null}
      </div>

      {/* Bảng sr-only lấy 12 mốc gần nhất để gọn cho trình đọc màn hình */}
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Thời gian</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.slice(-12).map((p) => (
              <tr key={p.at}>
                <td>{formatTimeVi(p.at)}</td>
                <td>
                  {formatNumberVi(p.value)}
                  {unitSuffix ? ` ${unitSuffix}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
