"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { areaPath, linearScale, smoothPath, type Point2D } from "./math";
import { CHART_COLORS, usePrefersReducedMotion } from "./use-chart-box";

export type SparklineProps = {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  ariaLabel: string;
};

export function Sparkline({
  values,
  color = CHART_COLORS.primary,
  width = 112,
  height = 34,
  ariaLabel,
}: SparklineProps) {
  const uid = useId().replace(/:/g, "");
  const pathRef = useRef<SVGPathElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const hasAnimated = useRef(false);

  const { lineD, areaD } = useMemo(() => {
    if (values.length === 0) return { lineD: "", areaD: "" };
    const padY = 4;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const lo = min === max ? Math.max(0, min - 1) : min;
    const hi = min === max ? max + 1 : max;

    const pts: Point2D[] = values.map((v, i) => ({
      x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
      y: linearScale(v, lo, hi, height - padY, padY),
    }));
    return {
      lineD: smoothPath(pts),
      areaD: areaPath(pts, height),
    };
  }, [values, width, height]);

  useEffect(() => {
    const path = pathRef.current;
    if (hasAnimated.current || reducedMotion || !path) return;
    const len = path.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return;

    const tween = gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      {
        strokeDashoffset: 0,
        duration: 0.75,
        ease: "power2.out",
        onComplete: () => {
          hasAnimated.current = true;
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
  }, [lineD, reducedMotion]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="block shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaD ? <path d={areaD} fill={`url(#spark-${uid})`} /> : null}
      {lineD ? (
        <path
          ref={pathRef}
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
