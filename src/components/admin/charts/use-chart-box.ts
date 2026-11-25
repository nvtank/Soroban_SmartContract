"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Đo chiều rộng khung biểu đồ bằng ResizeObserver để biểu đồ responsive mượt trên mọi kích thước.
 */
export function useChartWidth(ref: RefObject<HTMLElement | null>, fallback = 280): number {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.floor(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

/** Tôn trọng cài đặt giảm chuyển động của hệ điều hành. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/** Bảng màu khớp với token thiết kế của RentFlow. */
export const CHART_COLORS = {
  primary: "var(--primary, #0f8b6d)",
  primaryStrong: "var(--primary-strong, #0b6f57)",
  amber: "var(--amber, #f2a541)",
  amberInk: "var(--amber-ink, #7a4a05)",
  brick: "var(--brick, #c8553d)",
  ink: "var(--ink, #14213d)",
  inkSoft: "rgba(20, 33, 61, 0.55)",
  inkMuted: "rgba(20, 33, 61, 0.35)",
  grid: "rgba(20, 33, 61, 0.1)",
  surface: "var(--surface, #f2ede4)",
} as const;
