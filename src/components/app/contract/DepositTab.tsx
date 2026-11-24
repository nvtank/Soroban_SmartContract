"use client";

import React from "react";
import { StatusBadge, MoneyAmount, MockBadge } from "@/components/shared";
import { OnchainStamp } from "@/components/app/onchain-stamp";
import type { ContractDetailDto, OnchainTxDto } from "@/domain/dto";

export interface DepositTabProps {
  contract: ContractDetailDto;
  confirmedTx?: OnchainTxDto;
  isTenant: boolean;
  onPayDeposit: () => void;
}

export function DepositTab({
  contract,
  confirmedTx,
  isTenant,
  onPayDeposit,
}: DepositTabProps) {
  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 sm:p-8 space-y-6 w-full max-w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-lg sm:text-xl font-extrabold text-ink">Bảo chứng tiền cọc</h2>
          <p className="text-xs text-ink/60">
            Trạng thái do smart contract kiểm soát; ngân hàng và giải ngân tiền mặt là mô phỏng.
          </p>
        </div>
        <StatusBadge kind="deposit" status={contract.depositStatus} />
      </div>

      {/* Main Deposit Amount Card */}
      <div className="rounded-3xl border border-line bg-surface/40 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink/60">Số tiền cọc theo hợp đồng</span>
            <MockBadge label="MÔ PHỎNG" />
          </div>
          <MoneyAmount value={contract.depositAmount} size="xl" />
          <p className="text-xs text-ink/65">
            Đã ghi nhận nộp: <MoneyAmount value={contract.deposit.paidAmount} size="sm" />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {contract.depositStatus === "UNPAID" && isTenant && (
            <button
              type="button"
              data-tour="deposit-pay"
              onClick={onPayDeposit}
              className="w-full sm:w-auto rounded-full bg-primary px-6 py-3 text-sm font-bold text-paper shadow-xs transition-colors hover:bg-primary-strong cursor-pointer"
            >
              Nạp tiền cọc
            </button>
          )}

          {confirmedTx && contract.depositStatus !== "UNPAID" && (
            <OnchainStamp timestamp={confirmedTx.createdAt} />
          )}
        </div>
      </div>
    </section>
  );
}
