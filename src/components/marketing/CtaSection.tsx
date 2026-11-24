"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { marketingVi } from "@/i18n/sections/marketing";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { ArrowRight, Check, Key, UserCheck, ShieldCheck, FileText } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export function CtaSection() {
  const cta = marketingVi.chapter07;
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const headline = headlineRef.current;
    const cardsEl = cardsRef.current;
    if (!headline || !cardsEl) return;

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

      const cardEls = cardsEl.querySelectorAll(".role-card");
      gsap.from(cardEls, {
        scrollTrigger: {
          trigger: cardsEl,
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
      id="dung-thu"
      className="relative py-5 sm:py-8 overflow-hidden scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header chương 07 */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-sm">{cta.number}</span>
            <span>•</span>
            <span>{cta.subtitle}</span>
          </div>
          <h2
            ref={headlineRef}
            className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight text-ink"
          >
            {cta.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink/75">
            {cta.description}
          </p>
        </div>

        {/* Hai thẻ vai trò: Chủ nhà / Người thuê */}
        <div
          ref={cardsRef}
          className="mt-5 flex md:grid overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory gap-4 pb-2 md:grid-cols-2"
        >
          {/* Thẻ 1: Chủ nhà */}
          <div className="role-card flex w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto flex-col justify-between rounded-2xl border-2 border-line bg-paper p-4 sm:p-5 shadow-xs transition-colors hover:border-primary/50">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
                  <Key className="h-4 w-4" />
                  <span>{cta.landlordCard.role}</span>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink/60">
                  {cta.landlordCard.badge}
                </span>
              </div>

              <h3 className="mt-2 text-base sm:text-lg font-extrabold text-ink">
                {cta.landlordCard.title}
              </h3>

              <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink/80">
                {cta.landlordCard.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong mt-0.5 text-[9px]">
                      ✓
                    </span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 pt-3 border-t border-line/60">
              <MagneticButton
                href={cta.landlordCard.link}
                className="w-full rounded-xl bg-primary py-2.5 text-center text-xs sm:text-sm font-bold text-paper shadow-sm transition-colors hover:bg-primary-strong"
                ariaLabel={cta.landlordCard.cta}
              >
                <span>{cta.landlordCard.cta}</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </MagneticButton>
            </div>
          </div>

          {/* Thẻ 2: Người thuê */}
          <div className="role-card flex w-[85vw] max-w-[320px] shrink-0 snap-center md:w-auto flex-col justify-between rounded-2xl border-2 border-line bg-paper p-4 sm:p-5 shadow-xs transition-colors hover:border-primary/50">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
                  <UserCheck className="h-4 w-4" />
                  <span>{cta.tenantCard.role}</span>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink/60">
                  {cta.tenantCard.badge}
                </span>
              </div>

              <h3 className="mt-2 text-base sm:text-lg font-extrabold text-ink">
                {cta.tenantCard.title}
              </h3>

              <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink/80">
                {cta.tenantCard.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong mt-0.5 text-[9px]">
                      ✓
                    </span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 pt-3 border-t border-line/60">
              <MagneticButton
                href={cta.tenantCard.link}
                className="w-full rounded-xl bg-primary py-2.5 text-center text-xs sm:text-sm font-bold text-paper shadow-sm transition-colors hover:bg-primary-strong"
                ariaLabel={cta.tenantCard.cta}
              >
                <span>{cta.tenantCard.cta}</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </MagneticButton>
            </div>
          </div>
        </div>

        {/* Hướng dẫn vuốt trên di động */}
        <div className="mt-1 md:hidden flex items-center justify-between text-[11px] text-ink/40 px-1">
          <span>Vuốt chọn vai trò →</span>
          <span className="font-mono">1/2</span>
        </div>

        {/* Ghi chú chân trang dùng thử */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-line bg-surface/40 p-3.5 text-xs text-ink/70">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Tài khoản demo đã nạp sẵn dữ liệu kiểm thử, không yêu cầu thiết lập ví hay thẻ ngân hàng.</span>
          </div>

          <Link
            href="/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002"
            className="flex items-center gap-1 font-bold text-primary-strong hover:underline shrink-0"
            data-cursor-hover="true"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{cta.demoScriptLink}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
