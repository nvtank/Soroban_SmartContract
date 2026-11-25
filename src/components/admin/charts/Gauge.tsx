"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { formatPercentVi } from "./format";
import { describeArc } from "./math";
import { CHART_COLORS, usePrefersReducedMotion } from "./use-chart-box";

export type GaugeProps = {
  /** Tỷ lệ trong khoảng 0..1. */
  value: number;
  label: string;
  sublabel?: string;
  ariaLabel: string;
  size?: number;
};

export function Gauge({
  value,
  label,
  sublabel,
  ariaLabel,
  size = 210,
}: GaugeProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const arcRef = useRef<SVGPathElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [displayRatio, setDisplayRatio] = useState(reducedMotion ? clamped : 0);
  const prevRatioRef = useRef(0);

  const strokeWidth = 18;
  const cx = size / 2;
  const cy = size * 0.58;
  const radius = size * 0.39;
  const startAngle = -110;
  const endAngle = 110;
  const totalSweep = endAngle - startAngle;
  const arcLength = (totalSweep / 360) * 2 * Math.PI * radius;

  const trackD = describeArc(cx, cy, radius, startAngle, endAngle);

  const strokeColor =
    clamped >= 0.9
      ? CHART_COLORS.primary
      : clamped >= 0.75
        ? CHART_COLORS.amber
        : CHART_COLORS.brick;

  useEffect(() => {
    const startVal = prevRatioRef.current;
    prevRatioRef.current = clamped;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setDisplayRatio(clamped));
      if (arcRef.current) {
        arcRef.current.style.strokeDasharray = `${arcLength}`;
        arcRef.current.style.strokeDashoffset = `${arcLength * (1 - clamped)}`;
      }
      return () => cancelAnimationFrame(frame);
    }

    const proxy = { r: startVal };
    const tween = gsap.to(proxy, {
      r: clamped,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        setDisplayRatio(proxy.r);
        if (arcRef.current) {
          arcRef.current.style.strokeDasharray = `${arcLength}`;
          arcRef.current.style.strokeDashoffset = `${arcLength * (1 - proxy.r)}`;
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [clamped, arcLength, reducedMotion]);

  const height = Math.round(size * 0.72);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block overflow-visible"
      >
        <path
          d={trackD}
          fill="none"
          stroke="rgba(20, 33, 61, 0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          ref={arcRef}
          d={trackD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - displayRatio)}
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="tabular fill-ink text-3xl font-bold"
        >
          {formatPercentVi(displayRatio, 1)}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          className="fill-ink/65 text-xs font-medium"
        >
          {label}
        </text>
      </svg>
      {sublabel ? <p className="mt-2.5 text-center text-xs text-ink/65">{sublabel}</p> : null}

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <tbody>
            <tr>
              <th scope="row">{label}</th>
              <td>{formatPercentVi(clamped, 1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
