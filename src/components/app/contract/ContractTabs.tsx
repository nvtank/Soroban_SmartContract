"use client";

import React from "react";
import type { ContractTabKey } from "./types";

const TABS: { key: ContractTabKey; label: string; tourId: string }[] = [
  { key: "tong-quan", label: "1. Tổng quan", tourId: "tab-tong-quan" },
  { key: "tien-coc", label: "2. Tiền cọc", tourId: "tab-tien-coc" },
  { key: "tien-thue", label: "3. Tiền thuê & công nợ", tourId: "tab-tien-thue" },
  { key: "hoan-coc", label: "4. Hoàn cọc", tourId: "tab-hoan-coc" },
  { key: "bang-chung", label: "5. Bằng chứng on-chain", tourId: "tab-bang-chung" },
];

export interface ContractTabsProps {
  activeTab: ContractTabKey;
  onSwitchTab: (tab: ContractTabKey) => void;
}

export function ContractTabs({ activeTab, onSwitchTab }: ContractTabsProps) {
  return (
    <nav
      aria-label="Mục hợp đồng"
      className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/65 p-1 text-xs sm:text-sm font-semibold select-none w-full max-w-full min-w-0"
      data-lenis-prevent
    >
      {TABS.map((t) => {
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            data-tour={t.tourId}
            onClick={() => onSwitchTab(t.key)}
            className={`rounded-xl px-3.5 py-2 whitespace-nowrap transition-all cursor-pointer ${
              active
                ? "bg-paper font-bold text-ink shadow-xs"
                : "text-ink/65 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
