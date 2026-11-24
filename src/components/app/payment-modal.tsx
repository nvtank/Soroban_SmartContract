"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { PaymentDto } from "@/domain/dto";
import { apiClient } from "./api-client";
import { MockBadge, MoneyAmount } from "@/components/shared";

export interface PaymentModalProps {
  payment: PaymentDto;
  roomLabel: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function PaymentModal({ payment, roomLabel, onSuccess, onClose }: PaymentModalProps) {
  const [currentPayment, setCurrentPayment] = useState<PaymentDto>(payment);
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollCountRef = useRef(0);
  const MAX_POLLS = 15;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isActive = true;

    const poll = async () => {
      if (!isActive) return;
      if (currentPayment.status === "CONFIRMED" || currentPayment.status === "FAILED") {
        return;
      }

      if (pollCountRef.current >= MAX_POLLS) {
        setStatusMessage("Đã tạm dừng kiểm tra tự động. Bấm 'Kiểm tra lại' để đối soát.");
        return;
      }

      pollCountRef.current += 1;
      try {
        const updated = await apiClient.getPaymentById(payment.id);
        if (isActive && updated) {
          setCurrentPayment(updated);
          if (updated.status === "CONFIRMED") {
            setStatusMessage("Giao dịch đã xác nhận thành công!");
            setTimeout(() => {
              if (isActive) {
                onSuccess();
                onClose();
              }
            }, 1000);
            return;
          }
        }
      } catch {
        // Ignored during passive poll
      }

      if (isActive) {
        timer = setTimeout(poll, 3000);
      }
    };

    timer = setTimeout(poll, 3000);

    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [payment.id, currentPayment.status, onSuccess, onClose]);

  const handleSimulate = async (outcome: "CONFIRMED" | "UNDERPAID") => {
    setLoading(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await apiClient.simulatePayment(payment.id, outcome);
      setCurrentPayment(res.payment);

      if (outcome === "CONFIRMED") {
        setStatusMessage("Thanh toán thành công! Đang ghi nhận bằng chứng lên Stellar Testnet.");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setStatusMessage("Đã nhận tiền thiếu so với yêu cầu. Trạng thái: Nộp thiếu (UNDERPAID).");
        onSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi xử lý giao dịch");
    } finally {
      setLoading(false);
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await apiClient.recheckPayment(payment.id);
      setCurrentPayment(res);
      if (res.status === "CONFIRMED") {
        setStatusMessage("Đối soát thành công: Giao dịch đã xác nhận thành công!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else if (res.status === "PENDING") {
        setStatusMessage("Đang chờ xác nhận từ ngân hàng (mô phỏng).");
      } else if (res.status === "UNDERPAID") {
        setStatusMessage("Kết quả đối soát: Nộp thiếu tiền.");
      } else {
        setStatusMessage(`Trạng thái hiện tại: ${res.status}.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || "Không thể đối soát lúc này.");
    } finally {
      setRechecking(false);
    }
  };

  const formattedTestAmount = new Intl.NumberFormat("vi-VN").format(
    Number(currentPayment.expectedAmount),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-line bg-paper p-5 sm:p-7 shadow-soft space-y-5 max-h-[92vh] overflow-y-auto min-w-0"
        data-lenis-prevent
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="payment-modal-title" className="text-lg sm:text-xl font-extrabold text-ink">
                Thanh toán qua VietQR
              </h3>
              <MockBadge label="MÔ PHỎNG" />
            </div>
            <p className="text-xs text-ink/65 truncate">
              {currentPayment.kind === "DEPOSIT" ? "Tiền cọc · " : "Tiền thuê · "}
              <span className="font-semibold text-ink">{roomLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-surface hover:text-ink cursor-pointer shrink-0"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Amount + QR */}
        <div className="rounded-3xl border border-line bg-surface/45 p-5 text-center space-y-4">
          <div className="space-y-0.5">
            <MoneyAmount value={currentPayment.businessAmount} size="xl" />
            <p className="text-[11px] text-ink/60">
              Mã VietQR mô phỏng (mức thu thử nghiệm: {formattedTestAmount} đ)
            </p>
          </div>

          <div
            data-tour="payment-qr"
            className="inline-block rounded-2xl border border-line/60 bg-white p-3.5 shadow-xs"
          >
            <svg
              className="h-40 w-40 sm:h-44 sm:w-44"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Mã QR thanh toán VietQR mô phỏng"
            >
              <rect x="15" y="15" width="45" height="45" rx="6" stroke="#14213D" strokeWidth="6" />
              <rect x="27" y="27" width="21" height="21" fill="#14213D" />
              <rect x="140" y="15" width="45" height="45" rx="6" stroke="#14213D" strokeWidth="6" />
              <rect x="152" y="27" width="21" height="21" fill="#14213D" />
              <rect x="15" y="140" width="45" height="45" rx="6" stroke="#14213D" strokeWidth="6" />
              <rect x="27" y="152" width="21" height="21" fill="#14213D" />

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
              <circle cx="100" cy="100" r="15" fill="#0F8B6D" />
              <text x="100" y="105" textAnchor="middle" fill="#FBF8F3" fontSize="12" fontWeight="bold">
                R
              </text>
            </svg>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs">
            {currentPayment.status === "CONFIRMED" ? (
              <span className="font-bold text-primary-strong">Giao dịch đã xác nhận thành công</span>
            ) : currentPayment.status === "UNDERPAID" ? (
              <span className="font-bold text-amber-ink">Nộp thiếu tiền</span>
            ) : currentPayment.status === "FAILED" ? (
              <span className="font-bold text-brick-ink">Thanh toán thất bại</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ink/65">
                <span className="h-2 w-2 rounded-full bg-amber animate-pulse" aria-hidden="true" />
                <span>Chờ xác nhận ngân hàng (mô phỏng)</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleRecheck}
              disabled={rechecking || loading}
              className="font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
            >
              {rechecking ? "Đang đối soát…" : "Kiểm tra lại"}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-brick/30 bg-brick/10 p-3 text-center text-xs font-medium text-brick-ink">
            {error}
          </div>
        )}
        {statusMessage && (
          <div role="status" className="rounded-2xl border border-line bg-surface/70 p-3 text-center text-xs font-medium text-ink">
            {statusMessage}
          </div>
        )}

        {/* Bank simulation controls */}
        <div className="rounded-2xl border border-dashed border-line bg-surface/35 p-4 space-y-2.5">
          <div className="text-xs font-bold text-ink/75">Giả lập ngân hàng (demo)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              data-tour="payment-simulate-full"
              onClick={() => handleSimulate("CONFIRMED")}
              disabled={loading || rechecking}
              className="min-h-[42px] rounded-full bg-primary px-4 py-2 font-bold text-paper transition-colors hover:bg-primary-strong cursor-pointer disabled:opacity-50"
            >
              Giả lập: Đã nhận đủ tiền
            </button>
            <button
              type="button"
              onClick={() => handleSimulate("UNDERPAID")}
              disabled={loading || rechecking}
              className="min-h-[42px] rounded-full border border-line bg-paper px-4 py-2 font-semibold text-ink transition-colors hover:bg-surface cursor-pointer disabled:opacity-50"
            >
              Giả lập: Nộp thiếu tiền
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
