"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/app/app-navbar";
import { apiClient } from "@/components/app/api-client";
import { MockBadge } from "@/components/shared";

export default function AccountRecoveryPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [phone, setPhone] = useState("0900000002");
  const [otp, setOtp] = useState("123456");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "COMPLETED">("PENDING");
  const [loading, setLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPasskeyCreated, setNewPasskeyCreated] = useState(false);

  // Poll status at step 4
  useEffect(() => {
    if (step !== 4 || !requestId || recoveryStatus === "APPROVED" || recoveryStatus === "COMPLETED") {
      return;
    }
    let isActive = true;
    const interval = setInterval(async () => {
      try {
        const rec = await apiClient.getRecoveryById(requestId);
        if (isActive && rec && rec.status !== recoveryStatus) {
          setRecoveryStatus(rec.status as any);
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
      setRecoveryStatus((res.status as any) || "PENDING");
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
        setRecoveryStatus(rec.status as any);
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
      // 1. Gọi route reissue của recovery API
      await apiClient.reissueRecovery(requestId);

      // 2. Cấp lại Passkey bằng startRegistration thật (WebAuthn)
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        throw new Error("Trình duyệt này không hỗ trợ Passkey (WebAuthn).");
      }

      const optRes = await fetch("/api/auth/passkey/register/options", { method: "POST" });
      const optJson = await optRes.json().catch(() => ({}));
      if (!optRes.ok || optJson.error) {
        throw new Error(
          optJson.error?.message || "Chưa thể khởi tạo đăng ký Passkey (yêu cầu người dùng có phiên đăng nhập trên hệ thống).",
        );
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

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Khôi phục tài khoản RentFlow
            </h1>
            <MockBadge label="MÔ PHỎNG" />
          </div>
          <p className="text-xs sm:text-sm text-ink/70 max-w-xl mx-auto leading-relaxed">
            Quy trình hỗ trợ người dùng khi mất thiết bị hoặc đổi số điện thoại để lấy lại quyền truy cập ví cọc. Trong bản demo Ideathon, quy trình OTP và eKYC được mô phỏng an toàn.
          </p>
        </div>

        {/* Stepper responsive */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[11px] sm:text-xs font-semibold border-b border-line pb-4 select-none">
          <div className={step >= 1 ? "text-primary font-bold" : "text-ink/40"}>1. Nhập SĐT</div>
          <div className={step >= 2 ? "text-primary font-bold" : "text-ink/40"}>2. Mã OTP</div>
          <div className={step >= 3 ? "text-primary font-bold" : "text-ink/40"}>3. eKYC mô phỏng</div>
          <div className={step >= 4 ? "text-primary font-bold" : "text-ink/40"}>4. Duyệt & Cấp lại</div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-brick/10 border border-brick/30 text-brick text-xs sm:text-sm font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-surface/50 rounded-panel border border-line p-5 sm:p-8 shadow-soft space-y-6">
          {/* STEP 1: SĐT */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-ink">
                  1. Nhập số điện thoại tài khoản cần khôi phục
                </h2>
                <p className="text-xs text-ink/60">
                  Hệ thống sẽ tra cứu tài khoản và phát hành mã OTP xác thực mô phỏng.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink/80 block">Số điện thoại:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0900000002"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-base focus:outline-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs disabled:opacity-50"
              >
                {loading ? "Đang gửi yêu cầu…" : "Gửi mã xác thực OTP ➔"}
              </button>
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-ink">
                    2. Xác thực mã OTP gửi về số điện thoại
                  </h2>
                  <MockBadge label="MÔ PHỎNG" />
                </div>
                <p className="text-xs text-ink/60">
                  Mã xác thực đã được gửi tới số điện thoại <strong>{phone}</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink/80 block">Mã OTP 6 số:</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-center tracking-widest text-xl font-mono focus:outline-primary"
                  required
                />
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink/60 pt-1">
                  <span>Mã OTP demo cố định:</span>
                  <strong className="text-primary font-mono font-bold">123456</strong>
                  <MockBadge label="MÔ PHỎNG" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-xl border border-line text-ink/70 hover:bg-surface text-xs font-semibold cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs disabled:opacity-50"
                >
                  {loading ? "Đang xác thực…" : "Xác nhận OTP ➔"}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: eKYC Simulated */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-ink">3. Xác thực danh tính điện tử eKYC</h2>
                <MockBadge label="MÔ PHỎNG" />
              </div>

              <div className="p-4 rounded-xl bg-amber/15 border border-amber/40 text-xs text-amber-ink space-y-1">
                <strong>Lưu ý bảo mật:</strong> Bản demo không chụp hay tải ảnh CCCD thật của người dùng. Hệ thống sử dụng hình ảnh và đối soát khuôn mặt mô phỏng để bảo vệ quyền riêng tư.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-card bg-paper border border-dashed border-line text-center space-y-2">
                  <div className="text-3xl">🪪</div>
                  <div className="text-xs font-bold text-ink">Chụp mặt trước CCCD</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-primary font-semibold">
                    <span>✓ Đã quét mô phỏng</span>
                    <MockBadge label="MÔ PHỎNG" />
                  </div>
                </div>

                <div className="p-5 rounded-card bg-paper border border-dashed border-line text-center space-y-2">
                  <div className="text-3xl">🤳</div>
                  <div className="text-xs font-bold text-ink">Quét khuôn mặt sinh trắc học</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-primary font-semibold">
                    <span>✓ Khớp 99.2% mô phỏng</span>
                    <MockBadge label="MÔ PHỎNG" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl border border-line text-ink/70 hover:bg-surface text-xs font-semibold cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleStep3}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs disabled:opacity-50"
                >
                  {loading ? "Đang xử lý…" : "Hoàn tất xác thực eKYC mô phỏng ➔"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Admin Approval & Passkey Reset */}
          {step === 4 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center text-3xl">
                {recoveryStatus === "APPROVED" || recoveryStatus === "COMPLETED" || newPasskeyCreated ? "✓" : "⏳"}
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-ink">
                  {newPasskeyCreated || recoveryStatus === "COMPLETED"
                    ? "Khôi phục tài khoản hoàn tất!"
                    : recoveryStatus === "APPROVED"
                    ? "Yêu cầu khôi phục đã được phê duyệt!"
                    : "Yêu cầu khôi phục đang chờ Ban Quản trị duyệt"}
                </h2>
                <p className="text-xs sm:text-sm text-ink/70 max-w-md mx-auto leading-relaxed">
                  {newPasskeyCreated || recoveryStatus === "COMPLETED"
                    ? `Passkey mới đã được kích hoạt thành công trên thiết bị này cho số điện thoại ${phone}.`
                    : recoveryStatus === "APPROVED"
                    ? `Ban Quản trị đã duyệt yêu cầu và thu hồi Passkey cũ. Bạn hãy nhấn nút bên dưới để cấp lại Passkey mới.`
                    : `Yêu cầu khôi phục cho số điện thoại ${phone} đã được gửi lên hệ thống và đang chờ Admin phê duyệt.`}
                </p>
                {requestId && (
                  <p className="text-[11px] font-mono text-ink/50 pt-1">
                    Mã yêu cầu: {requestId}
                  </p>
                )}
              </div>

              {/* Status indicator & check button */}
              {recoveryStatus === "PENDING" && (
                <div className="p-4 rounded-xl bg-surface border border-line text-xs space-y-3 max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-2 text-ink font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber animate-ping" />
                    <span>Trạng thái: Đang chờ duyệt (PENDING)</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={checkStatus}
                      disabled={isCheckingStatus}
                      className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink font-semibold hover:bg-surface text-xs cursor-pointer"
                    >
                      {isCheckingStatus ? "Đang kiểm tra…" : "Kiểm tra lại trạng thái"}
                    </button>
                    <Link
                      href="/app/admin-demo"
                      className="px-3.5 py-1.5 rounded-lg bg-ink text-paper font-bold hover:bg-ink/90 transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>Mở Admin Demo để Duyệt</span>
                      <MockBadge label="DEMO" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Passkey re-enrollment */}
              <div className="pt-4 border-t border-line space-y-3 max-w-md mx-auto">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Cấp lại chữ ký Passkey mới (WebAuthn):
                </h3>
                {newPasskeyCreated || recoveryStatus === "COMPLETED" ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-primary/15 border border-primary/30 text-xs font-bold text-primary">
                      ✓ Đã cấp và kích hoạt Passkey mới thành công trên thiết bị này!
                    </div>
                    <Link
                      href="/dang-nhap"
                      className="inline-block px-5 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors text-xs"
                    >
                      Quay lại trang Đăng nhập ➔
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleCreateNewPasskey}
                      disabled={loading || recoveryStatus !== "APPROVED"}
                      className="w-full px-5 py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-xs sm:text-sm disabled:opacity-50 shadow-xs"
                    >
                      {loading
                        ? "Đang đăng ký Passkey…"
                        : recoveryStatus === "APPROVED"
                        ? "Thiết lập Passkey mới trên thiết bị này (WebAuthn)"
                        : "Chờ Admin duyệt để kích hoạt Passkey"}
                    </button>
                    {recoveryStatus !== "APPROVED" && (
                      <p className="text-[11px] text-ink/50">
                        Nút thiết lập Passkey sẽ tự động mở khóa ngay khi Admin phê duyệt yêu cầu.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
