"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { marketingVi } from "@/i18n/sections/marketing";
import { FACTS } from "@/content/facts";
import { vi } from "@/i18n/vi";
import { AlertTriangle, TrendingUp, Info } from "lucide-react";

export function ProblemSection() {
  const cards = marketingVi.chapter01.cards;
  const [counts, setCounts] = useState<{ [id: string]: number }>({
    rooms: 0,
    "affected-tenants": 0,
  });

  // Hiệu ứng đếm số từ FACTS (Counter animation)
  useEffect(() => {
    let startTime: number | null = null;
    const duration = 1800; // 1.8 giây

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Easing out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      const updated: { [id: string]: number } = {};
      FACTS.forEach((fact) => {
        updated[fact.id] = Math.floor(fact.value * ease);
      });
      setCounts(updated);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // 3D Card tilt effect
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  };

  return (
    <section id="van-de" className="relative py-20 sm:py-28 overflow-hidden">
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
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="tilt-card flex flex-col justify-between rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-soft transition-all"
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

        {/* Số liệu từ FACTS (Chương 01 - Đếm số kèm dòng nguồn) */}
        <div className="mt-12 rounded-3xl border border-line bg-surface/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink/70">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Thống kê quy mô khảo sát thị trường</span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FACTS.map((fact) => {
              const currentVal = counts[fact.id] ?? 0;
              const formattedVal = new Intl.NumberFormat("vi-VN").format(currentVal);

              return (
                <div
                  key={fact.id}
                  className="flex flex-col rounded-2xl border border-line bg-paper p-5 shadow-xs"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="tabular font-sans text-3xl sm:text-4xl font-black text-primary-strong">
                      {formattedVal}
                    </span>
                    <span className="text-base font-bold text-ink/80">{fact.unit}</span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-ink/80">{fact.label}</p>

                  {/* Dòng nguồn và nhãn Chưa xác minh nguồn theo mục 2 Brief */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3 text-xs text-ink/60">
                    <span className="font-semibold">Nguồn: {fact.source ?? "Tài liệu sơ bộ ideathon"}</span>
                    {!fact.verified && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber/20 px-2 py-0.5 text-[11px] font-bold text-amber-ink">
                        <Info className="h-3 w-3" />
                        <span>{vi.common.unverifiedSource}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Câu dẫn sang chương sau */}
        <div className="mt-10">
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
