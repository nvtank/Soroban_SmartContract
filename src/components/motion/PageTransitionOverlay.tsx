"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { vi } from "@/i18n/vi";

export function PageTransitionOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Không chạy hiệu ứng ở lần tải đầu tiên để tránh giật giao diện
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const overlay = overlayRef.current;
    const logo = logoRef.current;
    if (!overlay || !logo) return;

    // Timeline mở màn che màu mực (ink)
    const tl = gsap.timeline();
    tl.set(overlay, { display: "flex", clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)" })
      .to(overlay, {
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
        duration: 0.35,
        ease: "power3.inOut",
      })
      .fromTo(
        logo,
        { opacity: 0, scale: 0.85 },
        { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(1.5)" },
        "-=0.15"
      )
      .to(logo, { opacity: 0, scale: 1.05, duration: 0.15, delay: 0.1 })
      .to(overlay, {
        clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)",
        duration: 0.35,
        ease: "power3.inOut",
      })
      .set(overlay, { display: "none" });

    return () => {
      tl.kill();
    };
  }, [pathname]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] hidden items-center justify-center bg-ink text-paper"
      aria-hidden="true"
    >
      <div ref={logoRef} className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-paper shadow-lg">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 2l-2 2m-1-1l-3 3m2 2l-3 3m-2-2l-3 3m2 2l-3 3" />
            <circle cx="7.5" cy="16.5" r="4.5" />
          </svg>
        </div>
        <span className="font-sans text-xl font-bold tracking-tight">{vi.brand.name}</span>
      </div>
    </div>
  );
}
