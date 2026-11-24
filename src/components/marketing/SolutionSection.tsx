"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { marketingVi } from "@/i18n/sections/marketing";
import { DepositSafe, type DepositSafeState } from "@/components/motion/DepositSafe";
import { KeyRound, ShieldCheck, ArrowRight } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export function SolutionSection() {
  const [safeState, setSafeState] = useState<DepositSafeState>("RECORDED");
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const principlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const headline = headlineRef.current;
    const principles = principlesRef.current;
    if (!headline || !principles) return;

    const ctx = gsap.context(() => {
      // Blur-to-clear tiêu đề
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

      // Slide-in 3 nguyên tắc
      const items = principles.querySelectorAll(".principle-item");
      gsap.from(items, {
        scrollTrigger: {
          trigger: principles,
          start: "top 85%",
          once: true,
        },
        y: 25,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="giai-phap"
      className="relative py-5 sm:py-8 overflow-hidden scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header chương 03 */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-sm">{marketingVi.chapter03.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter03.subtitle}</span>
          </div>
          <h2
            ref={headlineRef}
            className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight text-ink"
          >
            {marketingVi.chapter03.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink/75">
            {marketingVi.chapter03.description}
          </p>
        </div>

        {/* Khối chính: Két cọc (Trái) & 3 nguyên tắc cốt lõi (Phải) */}
        <div className="mt-5 grid grid-cols-1 items-center gap-5 lg:grid-cols-12 lg:gap-8">
          {/* Cột trái: Két cọc hai chìa khóa (DepositSafe) */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-paper p-3 sm:p-4 shadow-xs lg:col-span-5">
            <DepositSafe
              state={safeState}
              amount={12000000}
              onSelectState={setSafeState}
            />
          </div>

          {/* Cột phải: 3 nguyên tắc và mô tả cơ chế */}
          <div className="flex flex-col justify-between lg:col-span-7">
            <div
              ref={principlesRef}
              className="flex lg:flex-col overflow-x-auto lg:overflow-visible no-scrollbar snap-x gap-2.5 sm:gap-3 pb-1"
            >
              {marketingVi.chapter03.principles.map((p, idx) => (
                <div
                  key={idx}
                  className="principle-item flex w-[78vw] max-w-[280px] shrink-0 snap-center lg:w-auto items-start gap-2.5 rounded-xl border border-line bg-surface/50 p-2.5 sm:p-3 transition-colors hover:bg-surface"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong mt-0.5">
                    {idx === 0 && <ShieldCheck className="h-3.5 w-3.5" />}
                    {idx === 1 && <KeyRound className="h-3.5 w-3.5" />}
                    {idx === 2 && <ShieldCheck className="h-3.5 w-3.5 text-brick" />}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-ink">{p.title}</h3>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-ink/70 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dòng tóm tắt đạo đức và nút link sang demo */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5 text-[11px] text-ink/60">
              <span>* Smart contract chỉ phát sự kiện giải ngân, không giữ tiền VNĐ.</span>
              <Link
                href="/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#hoan-coc"
                className="inline-flex items-center gap-1 font-bold text-primary-strong hover:underline"
                data-cursor-hover="true"
              >
                <span>Xem thao tác mở két trong demo</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
