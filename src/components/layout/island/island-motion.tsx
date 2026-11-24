"use client";

import { forwardRef, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { gsap } from "gsap";

export const REDUCED = "(prefers-reduced-motion: reduce)";
const HOVER = "(hover: hover) and (pointer: fine)";

function canAnimateHover() {
  return (
    typeof window !== "undefined" && !window.matchMedia(REDUCED).matches && window.matchMedia(HOVER).matches
  );
}

/**
 * Chữ cuộn lên khi rê chuột vào nút hoặc liên kết chứa nó.
 * Bản sao thứ hai có aria-hidden nên tên truy cập của nút không đổi.
 */
export function RollText({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const host = el?.closest("a, button");
    if (!el || !host || !canAnimateHover()) return;
    const lines = el.querySelectorAll("[data-roll]");
    const enter = () =>
      gsap.to(lines, { yPercent: -100, duration: 0.45, ease: "power3.out", overwrite: true });
    const leave = () => gsap.to(lines, { yPercent: 0, duration: 0.45, ease: "power3.out", overwrite: true });
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <span ref={ref} className={`relative inline-flex overflow-hidden ${className}`}>
      <span data-roll className="block">
        {children}
      </span>
      <span data-roll aria-hidden="true" className="absolute left-0 top-full block">
        {children}
      </span>
    </span>
  );
}

/** Logo chìa khóa trong vòng tròn; vòng ngoài là thanh tiến độ đọc trang. */
export const KeyMark = forwardRef<SVGCircleElement, { className?: string }>(function KeyMark(
  { className = "" },
  ref,
) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <circle
        ref={ref}
        cx="20"
        cy="20"
        r="18"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset="1"
        transform="rotate(-90 20 20)"
      />
      <circle cx="14.5" cy="20" r="4.5" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M19 20h9.5M25.5 20v3.2M28.5 20v4.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
});

/** Nút bị hút nhẹ theo con trỏ. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.3) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimateHover()) return;
    const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [ref, strength]);
}

/** Hiện bảng thả xuống: nở từ góc với độ trễ ngắn. */
export function popIn(el: HTMLElement | null, origin = "top right") {
  if (!el || window.matchMedia(REDUCED).matches) return;
  gsap.fromTo(
    el,
    { opacity: 0, y: -8, scale: 0.96, transformOrigin: origin },
    { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "power3.out" },
  );
  gsap.fromTo(
    el.querySelectorAll("[data-pop-item]"),
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.3, stagger: 0.035, ease: "power2.out", delay: 0.05 },
  );
}

/** Ẩn bảng thả xuống rồi mới gỡ khỏi DOM. */
export function popOut(el: HTMLElement | null, done: () => void) {
  if (!el || window.matchMedia(REDUCED).matches) {
    done();
    return;
  }
  gsap.to(el, { opacity: 0, y: -6, scale: 0.97, duration: 0.16, ease: "power2.in", onComplete: done });
}
