"use client";

import React from "react";
import { OnchainStamp } from "@/components/app/onchain-stamp";
import { OnchainProofChip } from "@/components/shared";
import { formatDateTime } from "@/components/app/date-format";
import type { ContractDetailDto, OnchainTxDto } from "@/domain/dto";

export interface OnchainProofTabProps {
  contract: ContractDetailDto;
  onchainTxs: OnchainTxDto[];
}

export function OnchainProofTab({ contract, onchainTxs }: OnchainProofTabProps) {
  const confirmedTx = onchainTxs.find((t) => t.status === "CONFIRMED");

  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 sm:p-8 space-y-6 w-full max-w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-extrabold text-ink">Bằng chứng On-chain</h2>
          <p className="text-xs sm:text-sm text-ink/65">
            Trên Stellar Testnet chỉ ghi mã hợp đồng nội bộ, mã băm SHA-256 có muối và trạng thái; không lưu họ tên hay số điện thoại.
          </p>
        </div>
        {confirmedTx && <OnchainStamp timestamp={confirmedTx.createdAt} />}
      </div>

      {/* Salted Doc Hash */}
      <div className="space-y-1.5">
        <span className="block text-xs font-bold text-ink/70">
          Mã băm SHA-256 hợp đồng (có muối)
        </span>
        <div className="rounded-2xl border border-line bg-surface/40 p-3.5 font-mono text-xs text-ink/80 break-all select-all">
          {contract.docHash || "Chưa có mã băm"}
        </div>
      </div>

      {/* Transactions List */}
      <div data-tour="onchain-list" className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink/70">
            Giao dịch Soroban trên Stellar Testnet ({onchainTxs.length})
          </span>
        </div>

        <div className="sm:hidden text-[11px] text-ink/50 font-medium">
          ↔ Cuộn ngang để xem đầy đủ bảng
        </div>

        <div
          className="overflow-x-auto w-full max-w-full min-w-0 rounded-2xl border border-line"
          data-lenis-prevent
        >
          <table className="w-full min-w-[580px] text-left text-xs sm:text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-line bg-surface/50 text-ink/60 font-semibold">
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Tx Hash</th>
                <th className="py-3 px-4">Thời điểm</th>
                <th className="py-3 px-4 text-right">Tra cứu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {onchainTxs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-ink/50">
                    Chưa có giao dịch on-chain nào.
                  </td>
                </tr>
              ) : (
                onchainTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface/25 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-ink">{tx.action}</td>
                    <td className="py-3.5 px-4">
                      <OnchainProofChip status={tx.status} showIcon={false} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-ink/70">
                      {tx.txHash ? `${tx.txHash.slice(0, 10)}…${tx.txHash.slice(-6)}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-ink/60">{formatDateTime(tx.createdAt)}</td>
                    <td className="py-3.5 px-4 text-right">
                      {tx.explorerUrl ? (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          Stellar Expert ↗
                        </a>
                      ) : (
                        <span className="text-ink/40 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
