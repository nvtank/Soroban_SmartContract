"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { apiClient } from "@/components/app/api-client";
import { MockBadge } from "@/components/shared";

type RecoveryStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

export default function AccountRecoveryPage() {
  const { role } = useSession();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [phone, setPhone] = useState("0900000002");
  const [otp, setOtp] = useState("123456");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("PENDING");
  const [loading, setLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPasskeyCreated, setNewPasskeyCreated] = useState(false);

  useEffect(() => {
    if (step !== 4 || !requestId || recoveryStatus === "APPROVED" || recoveryStatus === "COMPLETED") {
      return;
    }
    let isActive = true;
    const interval = setInterval(async () => {
      try {
        const rec = await apiClient.getRecoveryById(requestId);
        if (isActive && rec && rec.status !== recoveryStatus) {
          setRecoveryStatus(rec.status as RecoveryStatus);
        }
      } catch {
        // passive poll
      }
    }, 3000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [step, requestId, recoveryStatus]);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone || phone.trim().length < 8) {
      setError("Số điện thoại không hợp lệ (tối thiểu 8 chữ số).");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.submitRecovery(
        phone.trim(),
        "Yêu cầu khôi phục quyền truy cập (mô phỏng).",
      );
      setRequestId(res.id);
      setRecoveryStatus((res.status as RecoveryStatus) || "PENDING");
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gửi yêu cầu khôi phục thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length < 4) {
      setError("Vui lòng nhập mã OTP 6 số.");
      return;
    }
    if (!requestId) {
      setError("Thiếu mã yêu cầu khôi phục. Vui lòng quay lại bước 1.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.verifyRecoveryOtp(requestId, otp.trim());
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xác thực mã OTP thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    if (!requestId) {
      setError("Thiếu mã yêu cầu khôi phục. Vui lòng quay lại bước 1.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.ekycSimulate(requestId);
      setRecoveryStatus("PENDING");
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xác thực eKYC mô phỏng thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!requestId) return;
    setIsCheckingStatus(true);
    setError(null);
    try {
      const rec = await apiClient.getRecoveryById(requestId);
      if (rec) {
        setRecoveryStatus(rec.status as RecoveryStatus);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể kiểm tra trạng thái lúc này.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCreateNewPasskey = async () => {
    if (!requestId) {
      setError("Thiếu mã yêu cầu khôi phục.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.reissueRecovery(requestId);

      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        throw new Error("Trình duyệt này không hỗ trợ Passkey (WebAuthn).");
      }

      const optRes = await fetch("/api/auth/passkey/register/options", { method: "POST" });
      const optJson = await optRes.json().catch(() => ({}));
      if (!optRes.ok || optJson.error) {
        throw new Error(optJson.error?.message || "Chưa thể khởi tạo đăng ký Passkey.");
      }

      const { startRegistration } = await import("@simplewebauthn/browser");
      const credential = await startRegistration({ optionsJSON: optJson.data });

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || verifyJson.error) {
        throw new Error(verifyJson.error?.message || "Xác thực đăng ký Passkey thất bại.");
      }

      setNewPasskeyCreated(true);
      setRecoveryStatus("COMPLETED");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng ký cấp lại Passkey thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 mx-auto max-w-xl w-full px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Khôi phục tài khoản
            </h1>
            <MockBadge label="MÔ PHỎNG" />
          </div>
          <p className="text-xs sm:text-sm text-ink/65">
            Cấp lại quyền ký khi mất thiết bị. OTP và eKYC trong bản demo là mô phỏng.
          </p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
          {[
            { n: 1, label: "1. SĐT" },
            { n: 2, label: "2. OTP" },
            { n: 3, label: "3. eKYC" },
            { n: 4, label: "4. Duyệt" },
          ].map((s) => (
            <div
              key={s.n}
              className={`rounded-full border py-1.5 text-center ${
                step >= s.n
                  ? "border-primary/30 bg-primary/10 font-bold text-primary-strong"
                  : "border-line bg-surface/40 text-ink/45"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-brick/30 bg-brick/10 p-3.5 text-xs sm:text-sm font-medium text-brick-ink">
            {error}
          </div>
        )}

        <div className="rounded-[2rem] border border-line bg-paper p-6 sm:p-8 shadow-soft space-y-6">
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-ink">
                  1. Nhập số điện thoại cần khôi phục
                </h2>
                <p className="text-xs text-ink/60">
                  Hệ thống phát hành mã OTP mô phỏng cho tài khoản tương ứng.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Số điện thoại</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0900000002"
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 font-mono text-base text-ink focus:outline-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ink py-3 text-sm font-bold text-paper hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Đang gửi…" : "Gửi mã xác thực OTP"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-ink">
                  2. Xác thực mã OTP
                </h2>
                <p className="text-xs text-ink/60">
                  Mã OTP mô phỏng cho <strong>{phone}</strong> (mã demo: <strong className="font-mono">123456</strong>).
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-3 text-center font-mono text-xl tracking-[0.25em] text-ink focus:outline-primary"
                required
              />

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-full border border-line px-5 py-2.5 text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-full bg-ink py-2.5 text-sm font-bold text-paper hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Đang xác thực…" : "Xác nhận OTP"}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-ink">
                  3. Xác thực danh tính điện tử eKYC
                </h2>
                <p className="text-xs text-ink/60">
                  Bản demo không thu thập ảnh CCCD thật; bước đối soát dưới đây là mô phỏng.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-surface/35 p-4 space-y-1">
                  <div className="text-sm font-bold text-ink">Chụp mặt trước CCCD</div>
                  <div className="text-xs font-semibold text-primary-strong">Đã kiểm tra (mô phỏng)</div>
                </div>
                <div className="rounded-2xl border border-line bg-surface/35 p-4 space-y-1">
                  <div className="text-sm font-bold text-ink">Quét khuôn mặt sinh trắc học</div>
                  <div className="text-xs font-semibold text-primary-strong">Khớp mẫu (mô phỏng)</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-full border border-line px-5 py-2.5 text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleStep3}
                  disabled={loading}
                  className="flex-1 rounded-full bg-ink py-2.5 text-sm font-bold text-paper hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Đang xử lý…" : "Hoàn tất xác thực eKYC mô phỏng"}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-ink">
                  {newPasskeyCreated || recoveryStatus === "COMPLETED"
                    ? "Khôi phục tài khoản hoàn tất"
                    : recoveryStatus === "APPROVED"
                      ? "Yêu cầu khôi phục đã được phê duyệt"
                      : "Yêu cầu khôi phục đang chờ Ban Quản trị duyệt"}
                </h2>
                <p className="text-xs sm:text-sm text-ink/65">
                  {newPasskeyCreated || recoveryStatus === "COMPLETED"
                    ? `Passkey mới đã kích hoạt cho số ${phone}.`
                    : recoveryStatus === "APPROVED"
                      ? "Quản trị viên đã duyệt yêu cầu. Bấm nút bên dưới để đăng ký Passkey mới."
                      : `Yêu cầu cho số ${phone} đã ghi nhận và đang chờ quản trị viên phê duyệt.`}
                </p>
              </div>

              {recoveryStatus === "PENDING" && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/40 p-4 text-xs">
                  <span className="font-semibold text-amber-ink">Đang chờ duyệt (PENDING)</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={checkStatus}
                      disabled={isCheckingStatus}
                      className="rounded-full border border-line bg-paper px-3.5 py-1.5 font-bold text-ink hover:bg-surface cursor-pointer"
                    >
                      {isCheckingStatus ? "Đang kiểm tra…" : "Kiểm tra lại trạng thái"}
                    </button>
                    {role === "ADMIN_DEMO" && (
                      <Link
                        href="/app/admin-demo"
                        className="rounded-full bg-ink px-3.5 py-1.5 font-bold text-paper"
                      >
                        Trang duyệt
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {newPasskeyCreated || recoveryStatus === "COMPLETED" ? (
                <Link
                  href="/app"
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-bold text-paper hover:bg-primary-strong"
                >
                  Về bảng điều khiển
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateNewPasskey}
                  disabled={loading || recoveryStatus !== "APPROVED"}
                  className="w-full rounded-full bg-primary py-3 text-sm font-bold text-paper hover:bg-primary-strong transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading
                    ? "Đang đăng ký Passkey…"
                    : recoveryStatus === "APPROVED"
                      ? "Thiết lập Passkey mới trên thiết bị này"
                      : "Chờ phê duyệt để thiết lập Passkey mới"}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
