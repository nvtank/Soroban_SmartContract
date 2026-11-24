"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { marketingVi } from "@/i18n/sections/marketing";
import { FACTS } from "@/content/facts";
import { vi } from "@/i18n/vi";
import { AlertTriangle, TrendingUp, Info, ArrowRight } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function ProblemSection() {
  const cards = marketingVi.chapter01.cards;
  const sectionRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const factValueRefs = useRef<{ [id: string]: HTMLSpanElement | null }>({});

  // 1. Counter: Chỉ chạy khi vào khung nhìn và ghi trực tiếp vào textContent
  // KHÔNG gọi setState mỗi frame cuộn!
  useEffect(() => {
    const statsEl = statsRef.current;
    if (!statsEl) return;

    const st = ScrollTrigger.create({
      trigger: statsEl,
      start: "top 85%",
      once: true,
      onEnter: () => {
        let startTime: number | null = null;
        const duration = 1600; // 1.6 giây

        const animate = (timestamp: number) => {
          if (!startTime) startTime = timestamp;
          const progress = Math.min((timestamp - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

          FACTS.forEach((fact) => {
            const el = factValueRefs.current[fact.id];
            if (el) {
              const currentVal = Math.floor(fact.value * ease);
              el.textContent = new Intl.NumberFormat("vi-VN").format(currentVal);
            }
          });

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Đảm bảo số cuối cùng chính xác tuyệt đối
            FACTS.forEach((fact) => {
              const el = factValueRefs.current[fact.id];
              if (el) {
                el.textContent = new Intl.NumberFormat("vi-VN").format(fact.value);
              }
            });
          }
        };

        requestAnimationFrame(animate);
      },
    });

    return () => st.kill();
  }, []);

  // 2. 3D Card tilt: Cache rect khi hover, dùng quickTo, không có will-change hay transition-all
  const activeRectRef = useRef<DOMRect | null>(null);
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
    activeRectRef.current = card.getBoundingClientRect();
    rotateXQuickRef.current = gsap.quickTo(card, "rotationX", { duration: 0.25, ease: "power2.out" });
    rotateYQuickRef.current = gsap.quickTo(card, "rotationY", { duration: 0.25, ease: "power2.out" });
  };

  const handleCardMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = activeRectRef.current;
    if (!rect || !rotateXQuickRef.current || !rotateYQuickRef.current) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotX = ((y - centerY) / centerY) * -6;
    const rotY = ((x - centerX) / centerX) * 6;

    rotateXQuickRef.current(rotX);
    rotateYQuickRef.current(rotY);
  };

  const handleCardMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    activeRectRef.current = null;
    rotateXQuickRef.current = null;
    rotateYQuickRef.current = null;
    const card = e.currentTarget;
    gsap.to(card, {
      rotationX: 0,
      rotationY: 0,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  return (
    <section ref={sectionRef} id="van-de" className="relative py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header chương */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-base">{marketingVi.chapter01.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter01.subtitle}</span>
          </div>
          <h2 className="mt-2 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
            {marketingVi.chapter01.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-ink/75">
            {marketingVi.chapter01.description}
          </p>
        </div>

        {/* 3 Thẻ nỗi đau (Pain cards) */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.id}
              onMouseEnter={handleCardMouseEnter}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              className="tilt-card flex flex-col justify-between rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-soft"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-brick/10 px-3 py-1 text-xs font-bold text-brick-ink">
                    {card.badge}
                  </span>
                  <AlertTriangle className="h-4 w-4 text-brick" />
                </div>

                <h3 className="mt-6 text-xl sm:text-2xl font-bold leading-snug text-ink">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-ink/75">
                  {card.description}
                </p>
              </div>

              <div className="mt-8 border-t border-line/60 pt-4 text-xs font-medium text-brick-ink/90">
                <span className="font-bold">Hậu quả:</span> {card.impact}
              </div>
            </div>
          ))}
        </div>

        {/* Số liệu từ FACTS (Chương 01 - Đổi thành "Số liệu tham khảo từ brief") */}
        <div ref={statsRef} className="mt-12 rounded-3xl border border-line bg-surface/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/70">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Số liệu tham khảo từ brief</span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FACTS.map((fact) => (
              <div
                key={fact.id}
                className="flex flex-col rounded-2xl border border-line bg-paper p-5 shadow-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    ref={(el) => {
                      factValueRefs.current[fact.id] = el;
                    }}
                    className="tabular font-sans text-3xl sm:text-4xl font-black text-primary-strong"
                  >
                    0
                  </span>
                  <span className="text-base font-bold text-ink/80">{fact.unit}</span>
                </div>

                <p className="mt-2 text-sm font-medium text-ink/80">{fact.label}</p>

                {/* Dòng nguồn: nguồn null hiện "Chưa có nguồn" */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3 text-xs text-ink/60">
                  <span className="font-semibold">
                    Nguồn: {fact.source || "Chưa có nguồn"}
                  </span>
                  {!fact.verified && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber/20 px-2 py-0.5 text-[11px] font-bold text-amber-ink">
                      <Info className="h-3 w-3" />
                      <span>{vi.common.unverifiedSource}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nút Deep-Link thử bước này & Câu dẫn sang chương sau */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dang-nhap?demo=tenant&next=/app/hop-dong/ct-001#tong-quan"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-paper shadow-sm hover:bg-primary-strong transition-colors"
            data-cursor-hover="true"
          >
            <span>Thử bước này trong demo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <a
            href="#giai-phap"
            className="inline-flex items-center text-sm sm:text-base font-bold text-primary-strong hover:underline"
          >
            {marketingVi.chapter01.nextBridge}
          </a>
        </div>
      </div>
    </section>
  );
}
