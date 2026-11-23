"use client";

import React, { useState } from "react";
import { MockBadge } from "@/components/shared";

export interface StepUpModalProps {
  action: "SIGN_CONTRACT" | "APPROVE_REFUND" | "RESPOND_DEDUCTION" | "RESOLVE_DISPUTE";
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StepUpModal({
  action,
  title = "Xác thực bảo mật bước nâng cao",
  description = "Thao tác này tạo ra cam kết tài chính và pháp lý, yêu cầu chữ ký số cá nhân để xác nhận.",
  onSuccess,
  onCancel,
}: StepUpModalProps) {
  const [method, setMethod] = useState<"passkey" | "otp">("passkey");
  const [otp, setOtp] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      if (method === "passkey") {
        // Simulate Passkey WebAuthn prompt or fallback
        await new Promise((resolve) => setTimeout(resolve, 800));
      } else {
        if (otp.length < 6) {
          setError("Vui lòng nhập đủ 6 chữ số mã OTP.");
          setLoading(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      onSuccess();
    } catch {
      setError("Xác thực không thành công. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
    >
      <div className="w-full max-w-md bg-paper rounded-panel border border-line shadow-soft p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <h3 id="step-up-title" className="text-lg font-bold text-ink">
              {title}
            </h3>
            <MockBadge label="BẢO MẬT" />
          </div>
          <button
            onClick={onCancel}
            className="text-ink/40 hover:text-ink cursor-pointer p-1 text-lg leading-none"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <p className="text-xs sm:text-sm text-ink/70">{description}</p>

        {/* Method selection */}
        <div className="flex rounded-xl bg-surface p-1 border border-line">
          <button
            type="button"
            onClick={() => setMethod("passkey")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              method === "passkey" ? "bg-paper text-primary shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
          >
            🔑 Passkey (Khuyên dùng)
          </button>
          <button
            type="button"
            onClick={() => setMethod("otp")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              method === "otp" ? "bg-paper text-primary shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
          >
            📱 Mã OTP SMS
          </button>
        </div>

        {method === "passkey" ? (
          <div className="p-5 rounded-card bg-surface/40 border border-line text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center text-2xl">
              👆
            </div>
            <div className="text-sm font-bold text-ink">Chạm cảm biến vân tay hoặc Face ID</div>
            <p className="text-xs text-ink/60">
              Chữ ký bảo mật WebAuthn sẽ được kiểm chứng và ký ủy quyền giao dịch custody tại server.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink/80 block">Nhập mã OTP 6 số:</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              className="w-full text-center tracking-widest text-lg font-mono p-2.5 rounded-xl border border-line bg-paper text-ink focus:outline-primary"
              placeholder="123456"
            />
            <p className="text-[11px] text-ink/50 text-center">
              (Mã thử nghiệm demo: <strong>123456</strong>)
            </p>
          </div>
        )}

        {error && <div className="text-xs text-brick text-center font-medium">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-line text-ink font-semibold hover:bg-surface transition-colors cursor-pointer text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary text-paper font-semibold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
          >
            {loading ? "Đang xác thực…" : "Xác nhận & Ký"}
          </button>
        </div>
      </div>
    </div>
  );
}
