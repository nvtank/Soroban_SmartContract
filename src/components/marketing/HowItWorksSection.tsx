"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { marketingVi } from "@/i18n/sections/marketing";
import {
  FileSignature,
  QrCode,
  CalendarCheck,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Compass,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STEP_ICONS = [
  FileSignature,
  QrCode,
  CalendarCheck,
  KeyRound,
  ShieldAlert,
];

export function HowItWorksSection() {
  const steps = marketingVi.chapter04.steps;
  const sectionRef = useRef<HTMLElement>(null);
  const pinContainerRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pinContainer = pinContainerRef.current;
    const trackContainer = trackContainerRef.current;
    const track = trackRef.current;
    const dial = dialRef.current;
    if (!pinContainer || !trackContainer || !track) return;

    const mm = gsap.matchMedia();

    // Chỉ áp dụng pin cuộn ngang trên màn hình lớn >= 1024px và không bật reduced-motion
    mm.add(
      "(min-width: 1024px) and (min-height: 550px) and (prefers-reduced-motion: no-preference) and (pointer: fine)",
      () => {
        const getDistance = () => track.scrollWidth - trackContainer.clientWidth + 60;

        const tween = gsap.to(track, {
          x: () => -getDistance(),
          ease: "none",
          scrollTrigger: {
            trigger: pinContainer,
            pin: true,
            anticipatePin: 1,
            scrub: 1,
            start: "top top",
            end: () => `+=${getDistance()}`,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (dial) {
                dial.style.transform = `rotate(${self.progress * 360}deg)`;
              }
            },
          },
        });

        return () => {
          tween.kill();
        };
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hanh-trinh"
      className="relative w-full overflow-hidden scroll-mt-20"
    >
      {/* Anchor bí danh để hỗ trợ navbar cũ của Agent G (#cach-hoat-dong) */}
      <div id="cach-hoat-dong" className="absolute -top-24 pointer-events-none invisible" />

      {/* Container ghim toàn màn hình trên desktop */}
      <div
        ref={pinContainerRef}
        className="relative flex flex-col justify-center min-h-[85vh] lg:h-screen lg:max-h-screen py-12 lg:py-0 overflow-hidden"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          {/* Header chương 04 & Bánh xe quay tròn (Circular Dial) */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 lg:mb-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
                <span className="font-mono text-sm">{marketingVi.chapter04.number}</span>
                <span>•</span>
                <span>{marketingVi.chapter04.subtitle}</span>
              </div>
              <h2 className="mt-1.5 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
                {marketingVi.chapter04.title}
              </h2>
              <p className="mt-1.5 text-sm sm:text-base text-ink/75">
                {marketingVi.chapter04.description}
              </p>
            </div>

            {/* Bánh xe la bàn xoay tròn theo tiến trình cuộn (Circular step compass) */}
            <div className="hidden lg:flex items-center gap-2.5 rounded-2xl border border-line bg-paper px-4 py-2.5 shadow-xs">
              <div ref={dialRef} className="text-primary transition-transform will-change-transform">
                <Compass className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink/50">
                  Cuộn ngang
                </span>
                <span className="text-xs font-bold text-ink">5 Bước liên hoàn</span>
              </div>
            </div>
          </div>

          {/* Track cuộn ngang: Desktop pin-scroll, Mobile vuốt ngang mượt mà */}
          <div
            ref={trackContainerRef}
            className="w-full overflow-x-auto lg:overflow-visible no-scrollbar pb-4"
          >
            <div
              ref={trackRef}
              className="flex gap-5 sm:gap-6 w-max items-stretch will-change-transform"
            >
              {steps.map((st, idx) => {
                const IconComponent = STEP_ICONS[idx] || FileSignature;
                const isDispute = st.step === "DISPUTE";

                return (
                  <div
                    key={st.step}
                    className={`relative flex w-[260px] sm:w-[300px] lg:w-[340px] shrink-0 flex-col justify-between rounded-2xl border bg-paper p-4 sm:p-5 shadow-xs transition-colors ${
                      isDispute
                        ? "border-brick/40 hover:border-brick"
                        : "border-line hover:border-primary/50"
                    }`}
                  >
                    <div>
                      {/* Bước & Icon */}
                      <div className="flex items-center justify-between border-b border-line/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                              isDispute
                                ? "bg-brick text-paper"
                                : "bg-primary text-paper"
                            }`}
                          >
                            {st.stepNumber}
                          </span>
                          <span className="font-mono text-xs font-bold text-ink/50 uppercase">
                            Bước 0{idx + 1}
                          </span>
                        </div>
                        <IconComponent
                          className={`h-4 w-4 ${isDispute ? "text-brick" : "text-primary"}`}
                        />
                      </div>

                      {/* Tiêu đề & Mô tả ngắn */}
                      <h3 className="mt-3 text-lg font-bold text-ink">
                        {st.name}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-primary-strong">
                        {st.shortDesc}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-ink/75">
                        {st.detail}
                      </p>

                      {/* Hành động Soroban on-chain */}
                      <div className="mt-3 rounded-lg border border-line bg-surface/60 p-2.5 text-[11px] text-ink/80">
                        <span className="font-bold text-primary-strong">Ghi nhận Testnet: </span>
                        <span>{st.onchainAction}</span>
                      </div>
                    </div>

                    {/* Nút thử bước này trong demo */}
                    <div className="mt-4 pt-3 border-t border-line/60">
                      <Link
                        href={st.deepLink}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-strong hover:underline"
                        data-cursor-hover="true"
                      >
                        <span>Thử bước này trong demo</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hướng dẫn trên di động */}
          <div className="mt-2 lg:hidden flex items-center justify-between text-xs text-ink/50 px-1">
            <span>Vuốt ngang để xem 5 bước →</span>
            <span className="font-mono">1/5 ... 5/5</span>
          </div>
        </div>
      </div>
    </section>
  );
}
