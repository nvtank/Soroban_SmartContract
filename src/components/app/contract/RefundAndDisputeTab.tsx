"use client";

import React, { useState } from "react";
import { StatusBadge, MoneyAmount } from "@/components/shared";
import type { ContractDetailDto } from "@/domain/dto";

export interface RefundAndDisputeTabProps {
  contract: ContractDetailDto;
  isTenant: boolean;
  isLandlord: boolean;
  isDisputed: boolean;
  onApproveRefund: (amount: string) => void;
  onProposeDeduction: (amount: string, reason: string) => Promise<void>;
  onRespondDeduction: (deductionId: string, accept: boolean) => void;
  onOpenDispute: (note: string) => Promise<void>;
  onResolveDispute: (agreedAmount: string) => void;
}

export function RefundAndDisputeTab({
  contract,
  isTenant,
  isLandlord,
  isDisputed,
  onApproveRefund,
  onProposeDeduction,
  onRespondDeduction,
  onOpenDispute,
  onResolveDispute,
}: RefundAndDisputeTabProps) {
  const [refundAmount, setRefundAmount] = useState(contract.depositAmount);
  const [deductionAmount, setDeductionAmount] = useState("1000000");
  const [deductionReason, setDeductionReason] = useState("Khấu trừ hư hỏng thiết bị khi trả phòng");
  const [disputeNote, setDisputeNote] = useState("Hai bên chưa thống nhất chi phí khấu trừ");
  const [agreedAmount, setAgreedAmount] = useState(contract.depositAmount);
  const [submitting, setSubmitting] = useState(false);

  const handleDeductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onProposeDeduction(deductionAmount, deductionReason);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisputeOpen = async () => {
    setSubmitting(true);
    try {
      await onOpenDispute(disputeNote);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 sm:p-8 space-y-6 w-full max-w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-lg sm:text-xl font-extrabold text-ink">Hoàn cọc & Tranh chấp</h2>
          <p className="text-xs sm:text-sm text-ink/65">
            Tiền cọc chỉ giải ngân (mô phỏng) khi cả hai bên cùng đồng thuận; hệ thống không tự kết luận.
          </p>
        </div>
        <StatusBadge kind="deposit" status={contract.depositStatus} />
      </div>

      {isDisputed && (
        <div
          role="alert"
          className="rounded-3xl border border-brick/35 bg-brick/10 p-5 space-y-1"
        >
          <div className="text-sm font-extrabold text-brick-ink">
            Tiền cọc đang khóa do chờ xử lý tranh chấp
          </div>
          <p className="text-xs text-brick-ink/85 leading-relaxed">
            Hệ thống không tự giải ngân cho bất kỳ bên nào khi chưa có sự đồng thuận số tiền từ cả hai bên.
          </p>
        </div>
      )}

      {/* 1. Refund Agreement */}
      <div className="rounded-3xl border border-line bg-surface/35 p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-extrabold text-ink">Thỏa thuận hoàn tiền cọc</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-1">
            <span className="text-ink/55 block">Chủ nhà xác nhận</span>
            {contract.deposit.landlordRefundAmount ? (
              <MoneyAmount value={contract.deposit.landlordRefundAmount} size="md" />
            ) : (
              <span className="text-sm text-ink/45">Chưa xác nhận</span>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-1">
            <span className="text-ink/55 block">Người thuê xác nhận</span>
            {contract.deposit.tenantRefundAmount ? (
              <MoneyAmount value={contract.deposit.tenantRefundAmount} size="md" />
            ) : (
              <span className="text-sm text-ink/45">Chưa xác nhận</span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="Số tiền hoàn trả (đ)"
            aria-label="Số tiền hoàn trả"
            className="w-full sm:w-52 rounded-full border border-line bg-paper px-4 py-2.5 font-mono text-sm text-ink focus:outline-primary"
          />
          <button
            type="button"
            data-tour="refund-action"
            onClick={() => onApproveRefund(refundAmount)}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-paper transition-colors hover:bg-primary-strong cursor-pointer text-center"
          >
            Xác nhận hoàn cọc
          </button>
        </div>
      </div>

      {/* 2. Deduction Proposals */}
      <div className="rounded-3xl border border-line bg-surface/35 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink">Đề xuất khấu trừ</h3>
          <span className="text-xs text-ink/55">{contract.deductions.length} mục</span>
        </div>

        {contract.deductions.length === 0 ? (
          <p className="text-xs text-ink/55">Chưa có đề xuất khấu trừ nào.</p>
        ) : (
          <div className="space-y-2.5">
            {contract.deductions.map((ded) => (
              <div
                key={ded.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MoneyAmount value={ded.amount} size="md" />
                    <StatusBadge kind="deduction" status={ded.status} />
                  </div>
                  <p className="text-xs text-ink/75">{ded.reasonText}</p>
                </div>

                {ded.status === "PROPOSED" && isTenant && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRespondDeduction(ded.id, true)}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-paper hover:bg-primary-strong cursor-pointer"
                    >
                      Đồng ý khấu trừ
                    </button>
                    <button
                      type="button"
                      onClick={() => onRespondDeduction(ded.id, false)}
                      className="rounded-full border border-brick/35 bg-brick/10 px-4 py-1.5 text-xs font-bold text-brick-ink hover:bg-brick/20 cursor-pointer"
                    >
                      Từ chối (Tranh chấp)
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isLandlord && contract.status === "ACTIVE" && (
          <form onSubmit={handleDeductionSubmit} className="pt-3 border-t border-line/60 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="number"
                value={deductionAmount}
                onChange={(e) => setDeductionAmount(e.target.value)}
                placeholder="Số tiền khấu trừ (đ)"
                className="rounded-2xl border border-line bg-paper px-3.5 py-2 font-mono text-xs sm:text-sm text-ink"
                required
              />
              <input
                type="text"
                value={deductionReason}
                onChange={(e) => setDeductionReason(e.target.value)}
                placeholder="Lý do khấu trừ cụ thể"
                className="sm:col-span-2 rounded-2xl border border-line bg-paper px-3.5 py-2 text-xs sm:text-sm text-ink"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full border border-line bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-surface transition-colors cursor-pointer disabled:opacity-50"
            >
              Gửi đề xuất khấu trừ
            </button>
          </form>
        )}
      </div>

      {/* 3. Dispute */}
      <div className="rounded-3xl border border-line bg-surface/35 p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-extrabold text-ink">
          {isDisputed ? "Thỏa thuận giải quyết tranh chấp" : "Mở tranh chấp"}
        </h3>

        {!isDisputed ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              placeholder="Ghi ngắn gọn lý do bất đồng…"
              className="flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-xs sm:text-sm text-ink"
            />
            <button
              type="button"
              onClick={handleDisputeOpen}
              disabled={submitting}
              className="rounded-full border border-brick/35 bg-brick/10 px-5 py-2.5 text-xs sm:text-sm font-bold text-brick-ink hover:bg-brick/20 cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              Mở tranh chấp & Khóa cọc
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-1">
                <span className="text-ink/55 block">Chủ nhà đề xuất hoàn</span>
                {contract.dispute?.landlordAgreedAmount ? (
                  <MoneyAmount value={contract.dispute.landlordAgreedAmount} size="md" />
                ) : (
                  <span className="text-sm text-ink/45">Chưa gửi</span>
                )}
              </div>

              <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-1">
                <span className="text-ink/55 block">Người thuê đề xuất hoàn</span>
                {contract.dispute?.tenantAgreedAmount ? (
                  <MoneyAmount value={contract.dispute.tenantAgreedAmount} size="md" />
                ) : (
                  <span className="text-sm text-ink/45">Chưa gửi</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="number"
                value={agreedAmount}
                onChange={(e) => setAgreedAmount(e.target.value)}
                placeholder="Số tiền đồng thuận (đ)"
                className="w-full sm:w-52 rounded-full border border-line bg-paper px-4 py-2.5 font-mono text-sm text-ink"
              />
              <button
                type="button"
                onClick={() => onResolveDispute(agreedAmount)}
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-paper hover:bg-ink/90 cursor-pointer text-center"
              >
                Xác nhận số tiền đồng thuận
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
