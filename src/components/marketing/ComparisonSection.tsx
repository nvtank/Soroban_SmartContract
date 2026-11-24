"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { marketingVi } from "@/i18n/sections/marketing";
import { Check, Sparkles, ArrowRight } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function ComparisonSection() {
  const comparison = marketingVi.chapter05;
  const sectionRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // 13. Tô sáng quét qua cột RentFlow khi vào khung nhìn
  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;

    const st = ScrollTrigger.create({
      trigger: tableEl,
      start: "top 80%",
      once: true,
      onEnter: () => {
        const cells = tableEl.querySelectorAll(".rentflow-col-highlight");
        cells.forEach((cell) => {
          cell.classList.add("sweeping");
        });
      },
    });

    return () => st.kill();
  }, []);

  return (
    <section ref={sectionRef} id="so-sanh" className="relative py-20 sm:py-28 overflow-hidden scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề chương 05 */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-base">{comparison.number}</span>
            <span>•</span>
            <span>{comparison.subtitle}</span>
          </div>
          <h2 className="mt-2 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
            {comparison.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-ink/75">
            {comparison.description}
          </p>
        </div>

        {/* Bảng so sánh (Cột RentFlow sticky và tô sáng quét qua khi vào khung nhìn) */}
        <div ref={tableRef} className="mt-12 overflow-x-auto rounded-3xl border border-line bg-paper shadow-soft">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-xs font-bold uppercase tracking-wider text-ink/75">
                <th className="p-4 sm:p-5 w-1/5">{comparison.columns[0]}</th>
                {/* Cột RentFlow: sticky và có highlight sweep */}
                <th className="p-4 sm:p-5 w-1/4 bg-primary/10 text-primary-strong border-x border-primary/20 sticky left-0 lg:static z-10 backdrop-blur-none rentflow-col-highlight">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    <span>{comparison.columns[1]}</span>
                  </div>
                </th>
                <th className="p-4 sm:p-5 w-1/5">{comparison.columns[2]}</th>
                <th className="p-4 sm:p-5 w-1/5">{comparison.columns[3]}</th>
                <th className="p-4 sm:p-5 w-1/5">{comparison.columns[4]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 text-xs sm:text-sm">
              {comparison.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface/30 transition-colors">
                  {/* Tiêu chí */}
                  <td className="p-4 sm:p-5 font-bold text-ink bg-surface/20">
                    {row.criteria}
                  </td>

                  {/* Cột RentFlow (Sticky và nổi bật viền lục ngọc) */}
                  <td className="p-4 sm:p-5 font-semibold text-primary-strong bg-primary/5 border-x border-primary/20 leading-relaxed sticky left-0 lg:static z-10 rentflow-col-highlight">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{row.rentflow}</span>
                    </div>
                  </td>

                  {/* Ngân hàng truyền thống */}
                  <td className="p-4 sm:p-5 text-ink/70 leading-relaxed">
                    {row.bank}
                  </td>

                  {/* App quản lý phòng trọ */}
                  <td className="p-4 sm:p-5 text-ink/70 leading-relaxed">
                    {row.rentalApp}
                  </td>

                  {/* Dự án Web3 thuần */}
                  <td className="p-4 sm:p-5 text-ink/70 leading-relaxed">
                    {row.web3}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nút Deep-Link thử bước này & Câu dẫn sang chương sau */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dang-nhap?demo=landlord&next=/app"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-paper shadow-sm hover:bg-primary-strong transition-colors"
            data-cursor-hover="true"
          >
            <span>Thử bước này trong demo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <a
            href="#dung-thu"
            className="inline-flex items-center text-sm sm:text-base font-bold text-primary-strong hover:underline"
          >
            {comparison.nextBridge}
          </a>
        </div>
      </div>
    </section>
  );
}
