"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { marketingVi } from "@/i18n/sections/marketing";
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export function TruthSection() {
  const truth = marketingVi.chapter06;
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const headline = headlineRef.current;
    const columns = columnsRef.current;
    if (!headline || !columns) return;

    const ctx = gsap.context(() => {
      try {
        const split = new SplitText(headline, { type: "words" });
        gsap.from(split.words, {
          scrollTrigger: {
            trigger: headline,
            start: "top 85%",
            once: true,
          },
          y: 20,
          opacity: 0,
          filter: "blur(6px)",
          duration: 0.65,
          stagger: 0.025,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(split.words, { clearProps: "filter" });
          },
        });
      } catch {
        gsap.from(headline, {
          scrollTrigger: {
            trigger: headline,
            start: "top 85%",
            once: true,
          },
          y: 20,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
        });
      }

      const colEls = columns.querySelectorAll(".truth-col");
      gsap.from(colEls, {
        scrollTrigger: {
          trigger: columns,
          start: "top 85%",
          once: true,
        },
        y: 30,
        opacity: 0,
        duration: 0.65,
        stagger: 0.15,
        ease: "power2.out",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="su-that"
      className="relative py-5 sm:py-8 overflow-hidden scroll-mt-20"
    >
      {/* Anchor bí danh để hỗ trợ navbar cũ của Agent G (#so-sanh) */}
      <div id="so-sanh" className="absolute -top-24 pointer-events-none invisible" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header chương 06 */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-sm">{truth.number}</span>
            <span>•</span>
            <span>{truth.subtitle}</span>
          </div>
          <h2
            ref={headlineRef}
            className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight text-ink"
          >
            {truth.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink/75">
            {truth.description}
          </p>
        </div>

        {/* Khối 2 cột đối chiếu minh bạch: Chạy thật vs Mô phỏng */}
        <div
          ref={columnsRef}
          className="mt-5 flex md:grid overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory gap-4 pb-2 md:grid-cols-2"
        >
          {/* Cột 1: Chạy thật trên Stellar Testnet */}
          <div className="truth-col flex w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto flex-col justify-between rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-strong">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{truth.realSectionTitle}</span>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5">
                {truth.realFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-ink/85">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-strong mt-0.5 text-[9px]">
                      ✓
                    </span>
                    <span className="leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 border-t border-primary/20 pt-2 text-[10px] sm:text-[11px] text-primary-strong/80 font-medium">
              * Mọi dữ liệu đã kiểm thử thực tế trên mạng thử nghiệm Stellar Testnet.
            </div>
          </div>

          {/* Cột 2: Mô phỏng trong bản demo */}
          <div className="truth-col flex w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto flex-col justify-between rounded-2xl border-2 border-line bg-surface/50 p-4 sm:p-5 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-ink">
                <AlertTriangle className="h-4 w-4 text-amber-ink" />
                <span>{truth.simulatedSectionTitle}</span>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5">
                {truth.simulatedFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-ink/75">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-line text-ink/60 mt-0.5 text-[9px]">
                      —
                    </span>
                    <span className="leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3 border-t border-line/60 pt-2 text-[10px] sm:text-[11px] text-ink/60 font-medium">
              * Smart contract Soroban không giữ tiền VNĐ; giải ngân và OTP là giả lập an toàn.
            </div>
          </div>
        </div>

        {/* Hướng dẫn vuốt trên di động */}
        <div className="mt-1 md:hidden flex items-center justify-between text-[11px] text-ink/40 px-1">
          <span>Vuốt đối chiếu 2 cột →</span>
          <span className="font-mono">1/2</span>
        </div>

        {/* Liên kết bắt buộc tới trang Minh bạch & Đạo đức */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs sm:text-sm text-ink/80">
              Tìm hiểu toàn bộ danh mục phân ranh giới On-chain / Off-chain và cam kết không dùng AI phán xét tài chính.
            </p>
          </div>

          <Link
            href={truth.transparencyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-paper shadow-xs hover:bg-primary-strong transition-colors"
            data-cursor-hover="true"
          >
            <span>{truth.transparencyCta}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
