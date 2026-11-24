"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { marketingVi } from "@/i18n/sections/marketing";
import { AlertCircle, ArrowRight } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export function ProblemSection() {
  const cards = marketingVi.chapter02.cards;
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // GSAP: Blur vào rõ tiêu đề & Slide xuất hiện các thẻ
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const headline = headlineRef.current;
    const cardsEl = cardsContainerRef.current;
    if (!headline || !cardsEl) return;

    const ctx = gsap.context(() => {
      // 1. Blur-to-clear tiêu đề khi cuộn vào khung nhìn
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

      // 2. Slide xuất hiện 3 thẻ
      const cardEls = cardsEl.querySelectorAll(".problem-card");
      gsap.from(cardEls, {
        scrollTrigger: {
          trigger: cardsEl,
          start: "top 80%",
          once: true,
        },
        y: 35,
        opacity: 0,
        duration: 0.65,
        stagger: 0.12,
        ease: "power2.out",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // 3D Card tilt trên thiết bị có chuột (không gây forced reflow)
  const rotateXQuickRef = useRef<((v: number) => void) | null>(null);
  const rotateYQuickRef = useRef<((v: number) => void) | null>(null);

  const handleCardMouseEnter = (e: MouseEvent<HTMLDivElement>) => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }
    const card = e.currentTarget;
    rotateXQuickRef.current = gsap.quickTo(card, "rotationX", {
      duration: 0.25,
      ease: "power2.out",
    });
    rotateYQuickRef.current = gsap.quickTo(card, "rotationY", {
      duration: 0.25,
      ease: "power2.out",
    });
  };

  const handleCardMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!rotateXQuickRef.current || !rotateYQuickRef.current) return;
    const card = e.currentTarget;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (!width || !height) return;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    const rotX = ((y - height / 2) / (height / 2)) * -5;
    const rotY = ((x - width / 2) / (width / 2)) * 5;

    rotateXQuickRef.current(rotX);
    rotateYQuickRef.current(rotY);
  };

  const handleCardMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    rotateXQuickRef.current = null;
    rotateYQuickRef.current = null;
    const card = e.currentTarget;
    gsap.to(card, {
      rotationX: 0,
      rotationY: 0,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  return (
    <section
      ref={sectionRef}
      id="van-de"
      className="relative py-5 sm:py-8 overflow-hidden scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header chương 02 */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-sm">{marketingVi.chapter02.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter02.subtitle}</span>
          </div>
          <h2
            ref={headlineRef}
            className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight text-ink"
          >
            {marketingVi.chapter02.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink/75">
            {marketingVi.chapter02.description}
          </p>
        </div>

        {/* 3 Thẻ nỗi đau tinh gọn (Tối giản chữ và icon) */}
        <div
          ref={cardsContainerRef}
          className="mt-5 flex md:grid overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory gap-3 sm:gap-4 md:grid-cols-3 pb-2"
        >
          {cards.map((card, idx) => (
            <div
              key={card.id}
              onMouseEnter={handleCardMouseEnter}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              className="problem-card tilt-card flex w-[82vw] max-w-[300px] shrink-0 snap-center md:w-auto flex-col justify-between rounded-2xl border border-line bg-paper p-4 sm:p-5 shadow-xs hover:border-brick/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-brick-ink">
                    0{idx + 1}
                  </span>
                  <AlertCircle className="h-4 w-4 text-brick" />
                </div>

                <h3 className="mt-2.5 text-base sm:text-lg font-bold leading-snug text-ink">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-ink/70">
                  {card.description}
                </p>
              </div>

              <div className="mt-3.5 border-t border-line/60 pt-2 text-[11px] sm:text-xs font-medium text-brick-ink/90">
                <span className="font-bold">Hậu quả:</span> {card.impact}
              </div>
            </div>
          ))}
        </div>

        {/* Hướng dẫn vuốt trên di động */}
        <div className="mt-1 md:hidden flex items-center justify-between text-[11px] text-ink/40 px-1">
          <span>Vuốt xem 3 nỗi đau →</span>
          <span className="font-mono">1/3</span>
        </div>

        {/* Deep link thử nghiệm trong demo */}
        <div className="mt-6 flex items-center justify-start">
          <Link
            href="/dang-nhap?demo=tenant&next=/app/hop-dong/ct-001#tong-quan"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-strong hover:underline"
            data-cursor-hover="true"
          >
            <span>Xem cách RentFlow phân định hợp đồng trong demo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
