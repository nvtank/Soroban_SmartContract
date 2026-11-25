"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import type { DailyPoint } from "@/domain/admin/dto";

gsap.registerPlugin(useGSAP);

export type ActivityBarChartProps = {
  points: DailyPoint[];
  title?: string;
  subtitle?: string;
};

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

export function ActivityBarChart({
  points,
  title = "Hoạt động 30 ngày gần nhất",
  subtitle = "Số sự kiện ghi nhận theo từng ngày.",
}: ActivityBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = points.reduce((sum, p) => sum + p.value, 0);
  const maxVal = Math.max(1, ...points.map((p) => p.value));

  useGSAP(
    () => {
      if (points.length === 0) return;
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const bars = containerRef.current?.querySelectorAll(".activity-bar");
      if (!bars || bars.length === 0) return;
      gsap.fromTo(
        bars,
        { scaleY: 0, opacity: 0, transformOrigin: "bottom center" },
        {
          scaleY: 1,
          opacity: 1,
          duration: 0.45,
          stagger: 0.015,
          ease: "power2.out",
          clearProps: "transform,opacity",
        },
      );
    },
    { scope: containerRef, dependencies: [points.length] },
  );

  const width = 600;
  const height = 160;
  const padTop = 14;
  const padBottom = 24;
  const chartHeight = height - padTop - padBottom;
  const count = Math.max(1, points.length);
  const slotWidth = width / count;
  const barWidth = Math.max(6, Math.min(14, slotWidth - 4));

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <section
      ref={containerRef}
      className="rounded-3xl border border-line bg-paper p-5 shadow-[0_10px_30px_-24px_rgb(20_33_61/0.22)]"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <p className="text-xs text-ink/60">{subtitle}</p>
        </div>
        <div className="tabular text-right">
          {activePoint ? (
            <p className="text-sm font-bold text-primary-strong">
              {formatShortDate(activePoint.date)}: {activePoint.value} sự kiện
            </p>
          ) : (
            <p className="text-sm font-bold text-ink">
              {total.toLocaleString("vi-VN")}{" "}
              <span className="text-xs font-medium text-ink/60">sự kiện / 30 ngày</span>
            </p>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-2xl bg-surface/50 text-sm text-ink/55">
          Chưa có dữ liệu hoạt động trong 30 ngày qua.
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${title}, tổng ${total} sự kiện`}
            className="h-40 w-full select-none"
          >
            {/* Đường lưới ngang nhẹ */}
            <line
              x1={0}
              y1={padTop}
              x2={width}
              y2={padTop}
              stroke="currentColor"
              className="text-ink/10"
              strokeDasharray="3 4"
            />
            <line
              x1={0}
              y1={padTop + chartHeight / 2}
              x2={width}
              y2={padTop + chartHeight / 2}
              stroke="currentColor"
              className="text-ink/10"
              strokeDasharray="3 4"
            />
            <line
              x1={0}
              y1={padTop + chartHeight}
              x2={width}
              y2={padTop + chartHeight}
              stroke="currentColor"
              className="text-ink/15"
            />

            {points.map((pt, i) => {
              const barH = pt.value === 0 ? 3 : Math.max(6, (pt.value / maxVal) * chartHeight);
              const x = i * slotWidth + (slotWidth - barWidth) / 2;
              const y = padTop + chartHeight - barH;
              const isHovered = hoveredIdx === i;
              return (
                <g
                  key={pt.date}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={i * slotWidth}
                    y={0}
                    width={slotWidth}
                    height={height}
                    fill="transparent"
                  />
                  <rect
                    className={`activity-bar transition-colors ${
                      pt.value === 0
                        ? "fill-ink/15"
                        : isHovered
                          ? "fill-primary-strong"
                          : "fill-primary"
                    }`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={3}
                  />
                  {(i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1) && (
                    <text
                      x={x + barWidth / 2}
                      y={height - 6}
                      textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                      className="fill-ink/50 text-[10px] font-medium"
                    >
                      {formatShortDate(pt.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
