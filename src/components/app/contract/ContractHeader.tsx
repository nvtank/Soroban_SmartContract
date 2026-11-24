"use client";

import React from "react";
import Link from "next/link";
import { StatusBadge, MoneyAmount, resolvePrimaryContractBadge } from "@/components/shared";
import type { ContractDetailDto } from "@/domain/dto";
import type { ContractTabKey } from "./types";

export interface ContractHeaderProps {
  contract: ContractDetailDto;
  activeTab: ContractTabKey;
  isTenant: boolean;
  hasConfirmedOnchain: boolean;
  onConfirmContract: () => void;
  onSwitchTab: (tab: ContractTabKey) => void;
  onOpenDrawer: () => void;
}

function stripDemoSuffix(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  return name.replace(/\s*\([^)]*\)\s*/g, "").trim() || fallback;
}

export function ContractHeader({
  contract,
  activeTab,
  isTenant,
  hasConfirmedOnchain,
  onConfirmContract,
  onSwitchTab,
  onOpenDrawer,
}: ContractHeaderProps) {
  const primaryBadge = resolvePrimaryContractBadge(contract);
  const landlordName = stripDemoSuffix(contract.landlordName, "Nguyễn Văn An");
  const tenantName = stripDemoSuffix(contract.tenantName, "Trần Thị Bình");
  const isDisputed =
    contract.depositStatus === "PENDING_DISPUTE" ||
    (contract.disputeStatus !== "NONE" && contract.disputeStatus !== "RESOLVED");
  const hasOverdueRent = contract.rentPeriods.some((p) => p.status === "OVERDUE");

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb + Proof Drawer Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-ink/60 min-w-0">
          <Link href="/app" className="hover:text-ink transition-colors shrink-0">
            ← Bảng điều khiển
          </Link>
          <span>/</span>
          <span className="truncate font-semibold text-ink">{contract.roomLabel}</span>
        </div>

        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-surface cursor-pointer shrink-0"
        >
          <span>Bằng chứng On-chain</span>
          {hasConfirmedOnchain && (
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Main Contract Header Card */}
      <section className="rounded-[2rem] border border-line bg-paper p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                {contract.roomLabel}
              </h1>
              <StatusBadge
                kind={primaryBadge.kind}
                status={primaryBadge.status}
                dataTour="contract-status"
              />
            </div>

            <div
              data-tour="contract-parties"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-ink/70"
            >
              <span>
                Chủ nhà: <strong className="font-semibold text-ink">{landlordName}</strong>
              </span>
              <span className="text-ink/30" aria-hidden="true">
                ·
              </span>
              <span>
                Người thuê: <strong className="font-semibold text-ink">{tenantName}</strong>
              </span>
            </div>
          </div>

          {/* Key Amounts + Primary Contextual CTA */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-line/60">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink/50">
                Tiền thuê / tháng
              </span>
              <MoneyAmount value={contract.rentAmount} size="lg" />
            </div>

            <div className="h-9 w-px bg-line hidden sm:block" aria-hidden="true" />

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink/50">
                Tiền cọc
              </span>
              <MoneyAmount value={contract.depositAmount} size="lg" />
            </div>

            {contract.status === "PENDING_CONFIRMATION" && isTenant && (
              <button
                type="button"
                data-tour="confirm-sign"
                onClick={onConfirmContract}
                className="w-full sm:w-auto rounded-full bg-primary px-6 py-3 text-sm font-bold text-paper shadow-xs transition-colors hover:bg-primary-strong cursor-pointer"
              >
                Xác nhận & Ký hợp đồng
              </button>
            )}

            {contract.status === "ACTIVE" &&
              contract.depositStatus === "UNPAID" &&
              isTenant &&
              activeTab !== "tien-coc" && (
                <button
                  type="button"
                  onClick={() => onSwitchTab("tien-coc")}
                  className="w-full sm:w-auto rounded-full bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-paper transition-colors hover:bg-primary-strong cursor-pointer"
                >
                  Đến bước cọc →
                </button>
              )}

            {contract.status === "ACTIVE" &&
              hasOverdueRent &&
              activeTab !== "tien-thue" && (
                <button
                  type="button"
                  onClick={() => onSwitchTab("tien-thue")}
                  className="w-full sm:w-auto rounded-full border border-brick/35 bg-brick/10 px-4 py-2 text-xs font-bold text-brick-ink transition-colors hover:bg-brick/18 cursor-pointer"
                >
                  Xem kỳ quá hạn →
                </button>
              )}

            {isDisputed && activeTab !== "hoan-coc" && (
              <button
                type="button"
                onClick={() => onSwitchTab("hoan-coc")}
                className="w-full sm:w-auto rounded-full border border-brick/35 bg-brick/10 px-4 py-2 text-xs font-bold text-brick-ink transition-colors hover:bg-brick/18 cursor-pointer"
              >
                Xem tranh chấp →
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
