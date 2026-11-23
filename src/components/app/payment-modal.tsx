"use client";

import React, { useState } from "react";
import type { PaymentDto } from "@/domain/dto";
import { apiClient } from "./api-client";
import { MockBadge } from "@/components/shared";

export interface PaymentModalProps {
  payment: PaymentDto;
  roomLabel: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function PaymentModal({ payment, roomLabel, onSuccess, onClose }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<string>(payment.status);

  const handleSimulate = async (outcome: "CONFIRMED" | "UNDERPAID" | "OVERPAID" | "FAILED") => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.simulatePayment(payment.id, outcome);
      setOutcomeStatus(res.payment.status);

      if (outcome === "CONFIRMED") {
        setStatusMessage("Thanh toán thành công! Hệ thống đã ghi nhận và khởi tạo hàng đợi on-chain.");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else if (outcome === "UNDERPAID") {
        setStatusMessage("Đã nhận 5.000 ₫. Nộp thiếu so với yêu cầu thử nghiệm. Trạng thái: Nộp thiếu.");
        onSuccess();
      } else if (outcome === "OVERPAID") {
        setStatusMessage("Đã nhận 15.000 ₫. Nộp thừa. Phần dư đã được ghi nhận đối soát.");
        onSuccess();
      } else if (outcome === "FAILED") {
        setStatusMessage("Thanh toán thất bại hoặc người dùng đã hủy giao dịch.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi xử lý";
      setStatusMessage(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    // Simulate webhook reconciliation delay
    setTimeout(() => {
      setRechecking(false);
      setStatusMessage("Hệ thống đã đối soát với cổng thanh toán. Trạng thái hiện tại: " + outcomeStatus);
    }, 1000);
  };

  const formattedRealAmount = new Intl.NumberFormat("vi-VN").format(Number(payment.businessAmount));
  const formattedTestAmount = new Intl.NumberFormat("vi-VN").format(Number(payment.expectedAmount));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="w-full max-w-lg bg-paper rounded-panel border border-line shadow-soft p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 id="payment-modal-title" className="text-xl font-extrabold text-ink">
                Thanh toán qua VietQR
              </h3>
              <MockBadge label="MÔ PHỎNG" />
            </div>
            <p className="text-xs sm:text-sm text-ink/70">
              {payment.kind === "DEPOSIT" ? "Nạp tiền cọc bảo chứng cho: " : "Thanh toán tiền thuê cho: "}
              <strong className="text-ink">{roomLabel}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink/40 hover:text-ink hover:bg-surface cursor-pointer text-xl leading-none"
            aria-label="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* Demo payment amount notice banner */}
        <div className="p-3.5 rounded-xl bg-amber/15 border border-amber/40 text-xs sm:text-sm text-amber-ink space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>ℹ️</span> Số tiền thanh toán thử nghiệm: {formattedTestAmount} ₫
          </div>
          <p className="text-xs text-amber-ink/80">
            Số tiền cam kết theo hợp đồng là <strong>{formattedRealAmount} ₫</strong>. Trong môi trường thử nghiệm Ideathon, số tiền thanh toán thực qua VietQR được thu nhỏ để tiện kiểm thử.
          </p>
        </div>

        {/* QR Display */}
        <div className="flex flex-col items-center justify-center p-6 bg-surface/50 rounded-card border border-line text-center space-y-3">
          {/* VietQR Mock SVG Canvas */}
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-line/40 inline-block">
            <svg
              className="w-44 h-44 sm:w-52 sm:h-52"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Mã QR thanh toán VietQR mô phỏng"
            >
              {/* Corner position markers */}
              <rect x="15" y="15" width="45" height="45" rx="6" stroke="#14213D" strokeWidth="6" />
              <rect x="27" y="27" width="21" height="21" fill="#14213D" />

              <rect x="140" y="15" width="45" height="45" rx="6" stroke="#14213D" strokeWidth="6" />
              <rect x="152" y="27" width="21" height="21" fill="#14213D" />

              <rect x="15" y="140" width="45" height="45" rx="6" stroke="#14213D" strokeWidth="6" />
              <rect x="27" y="152" width="21" height="21" fill="#14213D" />

              {/* Data matrix pattern */}
              <rect x="75" y="25" width="10" height="10" fill="#14213D" />
              <rect x="100" y="25" width="10" height="10" fill="#14213D" />
              <rect x="75" y="50" width="10" height="10" fill="#14213D" />
              <rect x="115" y="50" width="10" height="10" fill="#14213D" />

              <rect x="25" y="75" width="10" height="10" fill="#14213D" />
              <rect x="50" y="75" width="10" height="10" fill="#14213D" />
              <rect x="75" y="75" width="10" height="10" fill="#0F8B6D" />
              <rect x="100" y="75" width="10" height="10" fill="#14213D" />
              <rect x="125" y="75" width="10" height="10" fill="#14213D" />
              <rect x="150" y="75" width="10" height="10" fill="#14213D" />

              <rect x="25" y="100" width="10" height="10" fill="#14213D" />
              <rect x="75" y="100" width="10" height="10" fill="#14213D" />
              <rect x="100" y="100" width="10" height="10" fill="#0F8B6D" />
              <rect x="125" y="100" width="10" height="10" fill="#14213D" />
              <rect x="165" y="100" width="10" height="10" fill="#14213D" />

              <rect x="75" y="125" width="10" height="10" fill="#14213D" />
              <rect x="100" y="125" width="10" height="10" fill="#14213D" />
              <rect x="125" y="125" width="10" height="10" fill="#14213D" />
              <rect x="150" y="125" width="10" height="10" fill="#14213D" />

              <rect x="75" y="150" width="10" height="10" fill="#14213D" />
              <rect x="110" y="150" width="10" height="10" fill="#14213D" />
              <rect x="140" y="150" width="10" height="10" fill="#14213D" />
              <rect x="165" y="150" width="10" height="10" fill="#14213D" />

              {/* Center Brand Badge */}
              <circle cx="100" cy="100" r="16" fill="#0F8B6D" />
              <text x="100" y="105" textAnchor="middle" fill="#FBF8F3" fontSize="12" fontWeight="bold">
                R
              </text>
            </svg>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink/70">
              <span className="w-2 h-2 rounded-full bg-amber animate-ping" />
              <span>Đang chờ xác nhận từ ngân hàng…</span>
            </div>
            <button
              onClick={handleRecheck}
              disabled={rechecking}
              className="text-xs text-primary font-bold hover:underline cursor-pointer"
            >
              {rechecking ? "Đang đối soát…" : "Kiểm tra lại"}
            </button>
          </div>
        </div>

        {/* Status message */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-surface border border-line text-xs font-medium text-ink text-center">
            {statusMessage}
          </div>
        )}

        {/* Simulation Controls for Ideathon Judges */}
        <div className="border-t border-line pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Giả lập tình huống kiểm thử (Demo):
            </span>
            <MockBadge label="SIMULATION" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleSimulate("CONFIRMED")}
              disabled={loading}
              className="p-2.5 rounded-xl bg-primary text-paper font-semibold hover:bg-primary-strong transition-colors cursor-pointer text-center"
            >
              Giả lập: Đã nhận đủ tiền
            </button>
            <button
              onClick={() => handleSimulate("UNDERPAID")}
              disabled={loading}
              className="p-2.5 rounded-xl bg-amber/20 text-amber-ink border border-amber/40 font-semibold hover:bg-amber/30 transition-colors cursor-pointer text-center"
            >
              Giả lập: Nộp thiếu tiền
            </button>
            <button
              onClick={() => handleSimulate("OVERPAID")}
              disabled={loading}
              className="p-2.5 rounded-xl bg-surface border border-line text-ink font-semibold hover:bg-line/20 transition-colors cursor-pointer text-center"
            >
              Giả lập: Nộp thừa tiền
            </button>
            <button
              onClick={() => handleSimulate("FAILED")}
              disabled={loading}
              className="p-2.5 rounded-xl bg-brick/15 text-brick border border-brick/40 font-semibold hover:bg-brick/25 transition-colors cursor-pointer text-center"
            >
              Giả lập: Thất bại / Hủy
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-line text-ink font-medium hover:bg-surface transition-colors cursor-pointer text-sm"
        >
          Đóng cửa sổ
        </button>
      </div>
    </div>
  );
}
