"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { marketingVi } from "@/i18n/sections/marketing";
import { ShieldCheck, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function ProblemSolutionHorizontal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeFlippedIndex, setActiveFlippedIndex] = useState<number | null>(null);

  const pairs = marketingVi.chapter02.pairs;

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    // Dùng gsap.matchMedia để tự dọn dẹp và chỉ kích hoạt khi desktop & không giảm chuyển động
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        gsap.to(track, {
          // x theo hàm để tự tính lại chính xác khi thay đổi kích thước cửa sổ
          x: () => -(track.scrollWidth - container.clientWidth),
          ease: "none",
          scrollTrigger: {
            trigger: container,
            pin: true,
            anticipatePin: 1,
            scrub: true, // Không trễ đúp với Lenis
            start: "top top+=80",
            end: () => `+=${track.scrollWidth - container.clientWidth}`,
            invalidateOnRefresh: true,
          },
        });
      }
    );

    return () => mm.revert();
  }, []);

  const toggleFlip = (index: number) => {
    setActiveFlippedIndex(activeFlippedIndex === index ? null : index);
  };

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden py-12 md:py-20">
      {/* Tiêu đề mục */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
          <span className="font-mono text-base">{marketingVi.chapter02.number}</span>
          <span>•</span>
          <span>{marketingVi.chapter02.subtitle}</span>
        </div>
        <h2 className="mt-2 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
          {marketingVi.chapter02.title}
        </h2>
        <p className="mt-3 max-w-2xl text-base sm:text-lg text-ink/75">
          {marketingVi.chapter02.description}
        </p>
      </div>

      {/* Track cuộn ngang (Pin scroll trên Desktop, swipe trên Mobile) */}
      <div className="w-full overflow-x-auto lg:overflow-visible no-scrollbar pb-6">
        <div
          ref={trackRef}
          className="flex gap-6 sm:gap-8 px-4 sm:px-6 lg:px-12 w-max items-stretch will-change-transform"
        >
          {pairs.map((pair, idx) => {
            const isFlipped = activeFlippedIndex === idx;

            return (
              <div
                key={idx}
                className="relative flex w-[320px] sm:w-[420px] md:w-[480px] flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-soft"
              >
                {/* Header thẻ: Cột mốc và nút lật */}
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface font-mono text-xs font-bold text-ink">
                      0{idx + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary-strong">
                      {pair.pillar}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFlip(idx)}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink/70 hover:border-primary hover:text-primary transition-colors"
                    aria-label={`Lật xem ${isFlipped ? "nỗi đau" : "giải pháp"}`}
                    data-cursor-hover="true"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{isFlipped ? "Xem nỗi đau" : "Lật giải pháp"}</span>
                  </button>
                </div>

                {/* Nội dung 2 mặt: Vấn đề ⇄ Giải pháp */}
                <div className="mt-6 flex flex-1 flex-col justify-between">
                  {!isFlipped ? (
                    /* Mặt trước: Nỗi đau thực tế */
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-brick-ink uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4 text-brick" />
                        <span>Vấn đề thực tế</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold leading-snug text-ink">
                        {pair.painTitle}
                      </h3>
                      <p className="text-sm sm:text-base leading-relaxed text-ink/75">
                        {pair.painDesc}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary-strong">
                        <span>Chuyển hóa bằng RentFlow</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  ) : (
                    /* Mặt sau: Giải pháp RentFlow */
                    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>Giải pháp RentFlow</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold leading-snug text-primary-strong">
                        {pair.solutionTitle}
                      </h3>
                      <p className="text-sm sm:text-base leading-relaxed text-ink/85">
                        {pair.solutionDesc}
                      </p>

                      <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-ink/80">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Bảo vệ quyền lợi công bằng cho cả hai bên</span>
                      </div>
                    </div>
                  )}

                  {/* Nút lật nhanh ở đáy thẻ */}
                  <div className="mt-8 pt-4 border-t border-line/60 flex items-center justify-between text-xs text-ink/50">
                    <span>Nhấn để đối chiếu 1-1</span>
                    <span className="font-mono">Ma trận Vấn đề ⇄ Giải pháp</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nút Deep-Link thử bước này & Câu dẫn sang chương sau */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#tong-quan"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-paper shadow-sm hover:bg-primary-strong transition-colors"
          data-cursor-hover="true"
        >
          <span>Thử bước này trong demo</span>
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="text-sm font-semibold text-primary-strong">
          {marketingVi.chapter02.nextBridge}
        </p>
      </div>
    </div>
  );
}
