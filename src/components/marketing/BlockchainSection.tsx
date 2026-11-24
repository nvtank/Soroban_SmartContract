"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { marketingVi } from "@/i18n/sections/marketing";
import { TestnetMarquee, type OnchainTxItem } from "@/components/motion/TestnetMarquee";
import { OnchainStamp } from "@/components/motion/OnchainStamp";
import { Cpu, ArrowRight } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export type BlockchainSectionProps = {
  transactions?: readonly OnchainTxItem[];
};

export function BlockchainSection({ transactions = [] }: BlockchainSectionProps) {
  const techCards = marketingVi.chapter05.techCards;
  const [feedTxs, setFeedTxs] = useState<readonly OnchainTxItem[]>(transactions);
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Nhận GET /api/public/onchain-feed. Nếu rỗng thì giữ trạng thái rỗng trung thực
  useEffect(() => {
    let isSubscribed = true;

    async function fetchOnchainFeed() {
      try {
        const res = await fetch("/api/public/onchain-feed", { cache: "no-store" });
        if (!res.ok) return;

        const body = await res.json();
        const rawItems = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : [];

        if (isSubscribed && rawItems.length > 0) {
          const mapped: OnchainTxItem[] = rawItems.map(
            (item: Record<string, unknown>, idx: number) => ({
              id: String(item.id || item.txHash || `tx-${idx}`),
              action: String(item.action || "Ghi nhận Soroban"),
              txHash: String(item.txHash || item.hash || ""),
              status: (item.status as OnchainTxItem["status"]) || "CONFIRMED",
              createdAt: item.createdAt ? String(item.createdAt) : undefined,
            })
          );
          setFeedTxs(mapped);
        }
      } catch {
        // Giữ feedTxs rỗng trung thực
      }
    }

    fetchOnchainFeed();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // GSAP: Blur vào rõ tiêu đề & Slide xuất hiện các thẻ
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

      const cardEls = cardsEl.querySelectorAll(".tech-card");
      gsap.from(cardEls, {
        scrollTrigger: {
          trigger: cardsEl,
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
      id="on-chain"
      className="relative py-5 sm:py-8 overflow-hidden scroll-mt-20"
    >
      {/* Anchor bí danh để hỗ trợ navbar cũ của Agent G (#blockchain) */}
      <div id="blockchain" className="absolute -top-24 pointer-events-none invisible" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header chương 05 */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-sm">{marketingVi.chapter05.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter05.subtitle}</span>
          </div>
          <h2
            ref={headlineRef}
            className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight text-ink"
          >
            {marketingVi.chapter05.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink/75">
            {marketingVi.chapter05.description}
          </p>
        </div>

        {/* Băng giao dịch Testnet thật */}
        <div className="mt-6">
          <TestnetMarquee transactions={feedTxs} />
        </div>

        {/* 3 Thẻ công nghệ cốt lõi */}
        <div
          ref={cardsRef}
          className="mt-5 flex md:grid overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory gap-3 sm:gap-4 md:grid-cols-3 pb-2"
        >
          {techCards.map((tech) => (
            <div
              key={tech.name}
              className="tech-card flex w-[82vw] max-w-[300px] shrink-0 snap-center md:w-auto flex-col justify-between rounded-2xl border border-line bg-paper p-4 sm:p-5 shadow-xs hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-strong">
                    {tech.status}
                  </span>
                  <Cpu className="h-3.5 w-3.5 text-ink/40" />
                </div>

                <h3 className="mt-2.5 text-sm sm:text-base font-bold text-ink">
                  {tech.name}
                </h3>
                <p className="text-[11px] font-semibold text-primary-strong">
                  {tech.role}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink/75">
                  {tech.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Hướng dẫn vuốt trên di động */}
        <div className="mt-1 md:hidden flex items-center justify-between text-[11px] text-ink/40 px-1">
          <span>Vuốt xem 3 công nghệ →</span>
          <span className="font-mono">1/3</span>
        </div>

        {/* Khối con dấu On-chain Stamp */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-5 rounded-2xl border border-line bg-surface/40 p-4 sm:p-5">
          <div className="max-w-xl">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-strong">
              Cơ chế đóng dấu bất biến
            </span>
            <h4 className="mt-0.5 text-base sm:text-lg font-bold text-ink">
              Mã băm SHA-256 có muối bảo vệ dữ liệu cá nhân
            </h4>
            <p className="mt-1 text-xs text-ink/70 leading-relaxed">
              Dấu vết trên Stellar Testnet khẳng định tính toàn vẹn của hợp đồng mà không bao giờ làm lộ danh tính cá nhân.
            </p>
          </div>

          <div className="shrink-0">
            <OnchainStamp
              text="ĐÃ GHI NHẬN ON-CHAIN"
              subText="STELLAR TESTNET • SOROBAN"
              interactive={true}
            />
          </div>
        </div>

        {/* Link thử bước này */}
        <div className="mt-5 flex items-center justify-start">
          <Link
            href="/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#bang-chung"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-strong hover:underline"
            data-cursor-hover="true"
          >
            <span>Xem ngăn bằng chứng on-chain trong demo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
