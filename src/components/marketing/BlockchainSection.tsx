"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { marketingVi } from "@/i18n/sections/marketing";
import { DataSortGame } from "@/components/motion/DataSortGame";
import { TestnetMarquee, type OnchainTxItem } from "@/components/motion/TestnetMarquee";
import { OnchainStamp } from "@/components/motion/OnchainStamp";
import { Cpu, ArrowRight } from "lucide-react";

export type BlockchainSectionProps = {
  transactions?: readonly OnchainTxItem[];
};

export function BlockchainSection({ transactions = [] }: BlockchainSectionProps) {
  const techCards = marketingVi.chapter04.techCards;
  const [feedTxs, setFeedTxs] = useState<readonly OnchainTxItem[]>(transactions);

  // 14. Nhận GET /api/public/onchain-feed (Agent D làm).
  // Nếu rỗng hoặc lỗi thì hiện trạng thái rỗng trung thực, tuyệt đối không hash giả.
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
        // Lỗi mạng hoặc route chưa sẵn sàng -> giữ feedTxs rỗng trung thực
      }
    }

    fetchOnchainFeed();

    return () => {
      isSubscribed = false;
    };
  }, []);

  return (
    <section id="blockchain" className="relative py-20 sm:py-28 overflow-hidden scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề chương 04 */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-base">{marketingVi.chapter04.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter04.subtitle}</span>
          </div>
          <h2 className="mt-2 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
            {marketingVi.chapter04.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-ink/75">
            {marketingVi.chapter04.description}
          </p>
        </div>

        {/* 1. Mini-Game: Kéo thả dữ liệu On-Chain & Off-Chain */}
        <div className="mt-12">
          <DataSortGame />
        </div>

        {/* 2. Băng chạy giao dịch Testnet thật (Trung thực, không dùng hash giả) */}
        <div className="mt-10">
          <TestnetMarquee transactions={feedTxs} />
        </div>

        {/* 3. Khối giải thích công nghệ: Vì sao chọn Stellar & Soroban */}
        <div className="mt-12">
          <h3 className="text-xl sm:text-2xl font-bold text-ink">
            Công nghệ cốt lõi & Lộ trình thực hiện
          </h3>
          <p className="mt-1 text-sm text-ink/70">
            Minh bạch những gì đã hoàn thiện trong bản demo và những gì thuộc lộ trình phát triển.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {techCards.map((tech) => {
              const isImplemented = !tech.status.includes("LỘ TRÌNH");

              return (
                <div
                  key={tech.name}
                  className="flex flex-col justify-between rounded-3xl border border-line bg-paper p-6 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isImplemented
                            ? "bg-primary/10 text-primary-strong"
                            : "bg-surface text-ink/60"
                        }`}
                      >
                        {tech.status}
                      </span>
                      <Cpu className="h-4 w-4 text-ink/40" />
                    </div>

                    <h4 className="mt-4 text-lg font-bold text-ink">{tech.name}</h4>
                    <p className="text-xs font-semibold text-primary-strong">{tech.role}</p>
                    <p className="mt-3 text-xs leading-relaxed text-ink/75">{tech.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Con dấu ON-CHAIN Stamp demo */}
        <div className="mt-12 rounded-3xl border border-line bg-surface/50 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-strong">
              Cơ chế đóng dấu bằng chứng
            </span>
            <h4 className="mt-1 text-lg sm:text-xl font-bold text-ink">
              Con dấu bất biến: &ldquo;ĐÃ GHI NHẬN ON-CHAIN&rdquo;
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-ink/70">
              Mỗi khi một giao dịch được xác nhận (CONFIRMED) bởi mạng lưới Soroban, con dấu điện tử được đóng xuống để khẳng định tính toàn vẹn của bằng chứng tranh chấp.
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

        {/* Nút Deep-Link thử bước này & Câu dẫn sang chương sau */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#bang-chung"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-paper shadow-sm hover:bg-primary-strong transition-colors"
            data-cursor-hover="true"
          >
            <span>Thử bước này trong demo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <a
            href="#so-sanh"
            className="inline-flex items-center text-sm sm:text-base font-bold text-primary-strong hover:underline"
          >
            {marketingVi.chapter04.nextBridge}
          </a>
        </div>
      </div>
    </section>
  );
}
