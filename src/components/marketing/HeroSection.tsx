"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { marketingVi } from "@/i18n/sections/marketing";
import { HeroKeyAnimation } from "@/components/motion/HeroKeyAnimation";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { ArrowRight, ShieldCheck, PlayCircle } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText);
}

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const ctaGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const headline = headlineRef.current;
    const desc = descRef.current;
    const ctaGroup = ctaGroupRef.current;
    if (!headline || !desc || !ctaGroup) return;

    const ctx = gsap.context(() => {
      // Tách chữ chỉ bằng words để không chèn thẻ lines gây vỡ dòng responsive
      try {
        const split = new SplitText(headline, { type: "words" });
        gsap.from(split.words, {
          y: 35,
          opacity: 0,
          duration: 0.8,
          stagger: 0.035,
          ease: "power3.out",
          delay: 0.1,
        });
      } catch {
        // Fallback nếu SplitText không khả dụng
        gsap.from(headline, { y: 25, opacity: 0, duration: 0.7, ease: "power3.out" });
      }

      gsap.from(desc, {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        delay: 0.45,
      });

      gsap.from(ctaGroup, {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        delay: 0.6,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[85vh] flex-col justify-center pt-28 pb-16 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary-strong">
            <ShieldCheck className="h-4 w-4" />
            <span>{marketingVi.hero.badgeIdeathon}</span>
          </div>

          <h1
            ref={headlineRef}
            className="mt-6 text-[length:var(--text-display)] font-extrabold leading-[1.05] tracking-tight text-ink"
          >
            <span>{marketingVi.hero.titleLine1}</span>{" "}
            <span className="text-primary-strong">{marketingVi.hero.titleLine2}</span>
          </h1>
        </div>

        <div className="mt-4 grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Cột trái: mô tả & CTA */}
          <div className="flex flex-col items-start lg:col-span-7">
            <p
              ref={descRef}
              className="mt-6 max-w-xl text-lg sm:text-xl leading-relaxed text-ink/80"
            >
              {marketingVi.hero.description}
            </p>

            {/* Hai nút CTA */}
            <div
              ref={ctaGroupRef}
              className="mt-8 flex flex-wrap items-center gap-4 sm:gap-5"
            >
              <MagneticButton
                href="/dang-nhap?demo=landlord&next=/app"
                className="rounded-2xl bg-primary px-7 py-4 text-base sm:text-lg font-bold text-paper shadow-md transition-colors hover:bg-primary-strong focus-visible:ring-4 focus-visible:ring-primary/20"
                ariaLabel={marketingVi.hero.ctaPrimary}
              >
                <span>{marketingVi.hero.ctaPrimary}</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </MagneticButton>

              <MagneticButton
                href="#cach-hoat-dong"
                className="rounded-2xl border-2 border-line bg-paper/80 px-6 py-4 text-base sm:text-lg font-bold text-ink shadow-xs transition-colors hover:border-primary hover:text-primary-strong"
                ariaLabel={marketingVi.hero.ctaSecondary}
              >
                <PlayCircle className="mr-2 h-5 w-5 text-primary" />
                <span>{marketingVi.hero.ctaSecondary}</span>
              </MagneticButton>
            </div>

            <p className="mt-8 text-xs font-medium text-ink/60">
              * {marketingVi.hero.trustNote}
            </p>
          </div>

          {/* Cột phải: Hình minh họa chìa khóa và ngôi nhà */}
          <div className="flex items-center justify-center lg:col-span-5">
            <HeroKeyAnimation />
          </div>
        </div>
      </div>
    </section>
  );
}
