"use client";

import React from "react";
import { formatDate } from "@/components/app/date-format";
import type { ContractDetailDto } from "@/domain/dto";

export interface OverviewTabProps {
  contract: ContractDetailDto;
  isTenant: boolean;
}

export function OverviewTab({ contract, isTenant }: OverviewTabProps) {
  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 sm:p-8 space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h2 className="text-lg sm:text-xl font-extrabold text-ink">Thông tin hợp đồng</h2>
        {contract.status === "PENDING_CONFIRMATION" && (
          <p className="text-xs sm:text-sm text-amber-ink font-medium">
            {isTenant
              ? "Kiểm tra điều khoản bên dưới và bấm 'Xác nhận & Ký hợp đồng' ở đầu trang để kích hoạt."
              : "Đang chờ người thuê kiểm tra và ký xác nhận hợp đồng."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-line bg-surface/40 p-4 space-y-1">
          <span className="text-xs text-ink/55">Thời hạn thuê</span>
          <div className="text-sm sm:text-base font-bold text-ink">
            {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/40 p-4 space-y-1">
          <span className="text-xs text-ink/55">Ngày thanh toán định kỳ</span>
          <div className="text-sm sm:text-base font-bold text-ink">
            Ngày {contract.dueDay} hàng tháng
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface/40 p-4 space-y-1">
          <span className="text-xs text-ink/55">Phí chậm trả thỏa thuận</span>
          <div className="text-sm sm:text-base font-bold text-ink">
            {contract.lateFeeBpsPerDay / 100}% / ngày
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface/25 p-5 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
          Điều khoản thỏa thuận
        </h3>
        <p className="text-sm text-ink/85 whitespace-pre-line leading-relaxed">
          {contract.termsText}
        </p>
      </div>
    </section>
  );
}
