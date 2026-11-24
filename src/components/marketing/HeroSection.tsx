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
      // SplitText theo words với hiệu ứng blur-to-clear mượt mà
      try {
        const split = new SplitText(headline, { type: "words" });
        gsap.from(split.words, {
          y: 25,
          opacity: 0,
          filter: "blur(6px)",
          duration: 0.75,
          stagger: 0.03,
          ease: "power2.out",
          delay: 0.1,
          onComplete: () => {
            gsap.set(split.words, { clearProps: "filter" });
          },
        });
      } catch {
        // Fallback nếu SplitText gặp lỗi
        gsap.from(headline, {
          y: 20,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
        });
      }

      gsap.from(desc, {
        y: 16,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        delay: 0.35,
      });

      gsap.from(ctaGroup, {
        y: 16,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        delay: 0.5,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="mo-dau"
      className="relative flex flex-col justify-center pt-14 pb-4 sm:pt-16 sm:pb-6 overflow-hidden scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary-strong">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{marketingVi.hero.badgeIdeathon}</span>
          </div>

          <h1
            ref={headlineRef}
            className="mt-2.5 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-ink"
          >
            <span>{marketingVi.hero.titleLine1}</span>{" "}
            <span className="text-primary-strong">{marketingVi.hero.titleLine2}</span>
          </h1>
        </div>

        <div className="mt-2 grid grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-8">
          {/* Cột trái: mô tả & CTA */}
          <div className="flex flex-col items-start lg:col-span-7">
            <p
              ref={descRef}
              className="mt-2 max-w-xl text-sm sm:text-base leading-relaxed text-ink/80"
            >
              {marketingVi.hero.description}
            </p>

            {/* Hai nút CTA */}
            <div
              ref={ctaGroupRef}
              className="mt-5 flex flex-wrap items-center gap-3"
            >
              <MagneticButton
                href="/dang-nhap?demo=landlord&next=/app"
                className="rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-paper shadow-md transition-colors hover:bg-primary-strong focus-visible:ring-4 focus-visible:ring-primary/20"
                ariaLabel={marketingVi.hero.ctaPrimary}
              >
                <span>{marketingVi.hero.ctaPrimary}</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </MagneticButton>

              <MagneticButton
                href="#hanh-trinh"
                className="rounded-xl border border-line bg-paper/80 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-ink shadow-xs transition-colors hover:border-primary hover:text-primary-strong"
                ariaLabel={marketingVi.hero.ctaSecondary}
              >
                <PlayCircle className="mr-1.5 h-3.5 w-3.5 text-primary" />
                <span>{marketingVi.hero.ctaSecondary}</span>
              </MagneticButton>
            </div>

            <p className="mt-3 text-[11px] font-medium text-ink/60">
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
