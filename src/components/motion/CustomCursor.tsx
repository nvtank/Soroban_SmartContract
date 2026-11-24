"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function CustomCursor() {
  const followerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Chỉ chạy với chuột chính xác (fine pointer) và không reduced motion
    if (
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const follower = followerRef.current;
    const dot = dotRef.current;
    if (!follower || !dot) return;

    // Thiết lập vị trí ban đầu
    gsap.set([follower, dot], { xPercent: -50, yPercent: -50, opacity: 0 });

    // Dùng gsap.quickTo để tối ưu hóa hiệu năng, không cấp phát tween mới mỗi frame
    const xDot = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power1.out" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power1.out" });
    const xFollower = gsap.quickTo(follower, "x", { duration: 0.35, ease: "power2.out" });
    const yFollower = gsap.quickTo(follower, "y", { duration: 0.35, ease: "power2.out" });

    let isVisible = false;

    const onMouseMove = (e: MouseEvent) => {
      if (!isVisible) {
        gsap.to([follower, dot], { opacity: 1, duration: 0.2 });
        isVisible = true;
      }
      xDot(e.clientX);
      yDot(e.clientY);
      xFollower(e.clientX);
      yFollower(e.clientY);
    };

    const onMouseLeave = () => {
      gsap.to([follower, dot], { opacity: 0, duration: 0.2 });
      isVisible = false;
    };

    // Dùng event delegation thay vì MutationObserver theo dõi toàn bộ DOM
    const INTERACTIVE_SELECTOR =
      "a, button, [role='button'], input, select, textarea, [data-cursor-hover]";

    const onPointerOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(INTERACTIVE_SELECTOR)) {
        // Phóng to bằng scale (GPU transform), KHÔNG đổi width/height gây layout reflow
        gsap.to(follower, { scale: 2, opacity: 0.25, duration: 0.2, overwrite: "auto" });
        gsap.to(dot, { scale: 0, duration: 0.15, overwrite: "auto" });
      }
    };

    const onPointerOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(INTERACTIVE_SELECTOR)) {
        gsap.to(follower, { scale: 1, opacity: 0.35, duration: 0.2, overwrite: "auto" });
        gsap.to(dot, { scale: 1, duration: 0.15, overwrite: "auto" });
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave, { passive: true });
    document.addEventListener("mouseover", onPointerOver, { passive: true });
    document.addEventListener("mouseout", onPointerOut, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseover", onPointerOver);
      document.removeEventListener("mouseout", onPointerOut);
    };
  }, []);

  return (
    <>
      <div ref={followerRef} className="custom-cursor-follower" aria-hidden="true" />
      <div ref={dotRef} className="custom-cursor-dot" aria-hidden="true" />
    </>
  );
}
