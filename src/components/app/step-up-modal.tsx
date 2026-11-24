"use client";

import React, { useState, useEffect } from "react";
import { Fingerprint, X } from "lucide-react";
import { MockBadge } from "@/components/shared";

export interface StepUpModalProps {
  action: "SIGN_CONTRACT" | "APPROVE_REFUND" | "RESPOND_DEDUCTION" | "RESOLVE_DISPUTE" | "EXTEND_DUE";
  title?: string;
  description?: string;
  onSuccess: (stepUpToken: string) => void | Promise<void>;
  onCancel: () => void;
}

export function StepUpModal({
  action,
  title = "Xác nhận chữ ký",
  description = "Xác thực bước hai để ghi nhận cam kết của bạn.",
  onSuccess,
  onCancel,
}: StepUpModalProps) {
  const [method, setMethod] = useState<"passkey" | "otp">("passkey");
  const [otp, setOtp] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      if (process.env.NEXT_PUBLIC_UI_MOCK === "true") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await onSuccess("demo-step-up");
        return;
      }

      let credential: unknown = undefined;
      if (method === "passkey") {
        if (typeof window === "undefined" || !window.PublicKeyCredential) {
          throw new Error("Trình duyệt chưa hỗ trợ Passkey. Hãy chuyển sang OTP (mô phỏng).");
        }
        const optRes = await fetch("/api/auth/passkey/auth/options", { method: "POST" });
        const optJson = await optRes.json().catch(() => ({}));
        if (!optRes.ok || !optJson.data) {
          throw new Error(optJson.error?.message || "Chưa thể bắt đầu xác thực Passkey.");
        }
        try {
          const { startAuthentication } = await import("@simplewebauthn/browser");
          credential = await startAuthentication({ optionsJSON: optJson.data });
        } catch {
          throw new Error(
            "Chưa xác thực được Passkey trên thiết bị này. Bạn có thể chuyển sang tab OTP (mô phỏng).",
          );
        }
      } else if (otp.length < 6) {
        throw new Error("Vui lòng nhập đủ 6 chữ số mã OTP.");
      }

      const res = await fetch("/api/auth/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          method === "passkey" ? { method, action, credential } : { method, action, code: otp },
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.data?.stepUpToken) {
        throw new Error(json.error?.message || "Xác thực không thành công. Vui lòng thử lại.");
      }
      await onSuccess(json.data.stepUpToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xác thực không thành công. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-action={action}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-line bg-paper p-6 sm:p-7 shadow-soft space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="step-up-title" className="text-lg font-extrabold text-ink">
                {title}
              </h3>
              {method === "otp" && <MockBadge label="MÔ PHỎNG" />}
            </div>
            <p className="text-xs text-ink/65">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-surface hover:text-ink cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Method segmented control */}
        <div className="flex rounded-full border border-line bg-surface p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMethod("passkey")}
            className={`flex-1 rounded-full py-2 transition-colors cursor-pointer ${
              method === "passkey" ? "bg-paper font-bold text-ink shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
          >
            Passkey
          </button>
          <button
            type="button"
            data-tour="stepup-otp-tab"
            onClick={() => setMethod("otp")}
            className={`flex-1 rounded-full py-2 transition-colors cursor-pointer ${
              method === "otp" ? "bg-paper font-bold text-ink shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
          >
            OTP (mô phỏng)
          </button>
        </div>

        {method === "passkey" ? (
          <div className="rounded-2xl border border-line bg-surface/40 p-5 text-center space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div className="text-sm font-bold text-ink">Xác thực bằng Passkey trên thiết bị</div>
            <p className="text-xs text-ink/60">
              Dùng vân tay, khuôn mặt hoặc thiết bị bảo mật đã đăng ký.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="stepup-otp-field" className="block text-xs font-semibold text-ink/80">
              Mã OTP 6 số (mô phỏng · mã demo: 123456)
            </label>
            <input
              id="stepup-otp-field"
              data-tour="stepup-otp-input"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              className="w-full rounded-2xl border border-line bg-surface/40 p-3 text-center font-mono text-xl tracking-[0.3em] text-ink focus:outline-primary"
              placeholder="123456"
            />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-brick/30 bg-brick/10 p-3 text-center text-xs font-medium text-brick-ink"
          >
            {error}
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-line py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            data-tour="stepup-submit"
            onClick={handleVerify}
            disabled={loading}
            className="flex-1 rounded-full bg-ink py-2.5 text-sm font-bold text-paper transition-colors hover:bg-ink/90 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Đang xác thực…" : "Xác nhận & Ký"}
          </button>
        </div>
      </div>
    </div>
  );
}
