"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/app/app-navbar";
import { apiClient } from "@/components/app/api-client";
import { MockBadge } from "@/components/shared";

export default function AccountRecoveryPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [phone, setPhone] = useState("0900000002");
  const [otp, setOtp] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPasskeyCreated, setNewPasskeyCreated] = useState(false);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone || phone.trim().length < 8) {
      setError("Số điện thoại không hợp lệ");
      return;
    }
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length < 4) {
      setError("Vui lòng nhập mã OTP 6 số");
      return;
    }
    setStep(3);
  };

  const handleStep3 = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.submitRecovery(phone, "Yêu cầu khôi phục quyền truy cập (eKYC mô phỏng hoàn tất)");
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gửi yêu cầu khôi phục thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewPasskey = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setNewPasskeyCreated(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Khôi phục tài khoản RentFlow
            </h1>
            <MockBadge label="MÔ PHỎNG" />
          </div>
          <p className="text-xs sm:text-sm text-ink/70 max-w-xl mx-auto">
            Quy trình hỗ trợ người dùng khi mất thiết bị hoặc đổi số điện thoại để lấy lại quyền truy cập ví cọc. Trong bản demo Ideathon, quy trình eKYC và phê duyệt được mô phỏng.
          </p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold border-b border-line pb-4">
          <div className={step >= 1 ? "text-primary" : "text-ink/40"}>1. Nhập SĐT</div>
          <div className={step >= 2 ? "text-primary" : "text-ink/40"}>2. Mã OTP</div>
          <div className={step >= 3 ? "text-primary" : "text-ink/40"}>3. eKYC mô phỏng</div>
          <div className={step >= 4 ? "text-primary" : "text-ink/40"}>4. Duyệt & Cấp lại</div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-brick/10 border border-brick/30 text-brick text-xs sm:text-sm font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-surface/50 rounded-panel border border-line p-6 sm:p-8 shadow-soft space-y-6">
          {/* STEP 1: SĐT */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <h2 className="text-base font-bold text-ink">
                1. Nhập số điện thoại tài khoản cần khôi phục
              </h2>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink/80 block">Số điện thoại:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-base focus:outline-primary"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
              >
                Gửi mã xác thực OTP ➔
              </button>
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <h2 className="text-base font-bold text-ink">
                2. Xác thực mã OTP gửi về số điện thoại
              </h2>
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
                <p className="text-[11px] text-ink/50 text-center">
                  Mã OTP demo cố định: <strong>123456</strong>
                </p>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
              >
                Xác nhận OTP ➔
              </button>
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

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-card bg-paper border border-dashed border-line text-center space-y-2">
                  <div className="text-3xl">🪪</div>
                  <div className="text-xs font-bold text-ink">Chụp mặt trước CCCD</div>
                  <div className="text-[11px] text-primary font-semibold">✓ Đã quét mô phỏng</div>
                </div>

                <div className="p-5 rounded-card bg-paper border border-dashed border-line text-center space-y-2">
                  <div className="text-3xl">🤳</div>
                  <div className="text-xs font-bold text-ink">Quét khuôn mặt sinh trắc học</div>
                  <div className="text-[11px] text-primary font-semibold">✓ Khớp 99.2% mô phỏng</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStep3}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs disabled:opacity-50"
              >
                {loading ? "Đang xử lý…" : "Gửi yêu cầu khôi phục tới Admin"}
              </button>
            </div>
          )}

          {/* STEP 4: Admin Approval & Passkey Reset */}
          {step === 4 && (
            <div className="space-y-5 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center text-3xl">
                ⏳
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-ink">Yêu cầu khôi phục đã được tiếp nhận</h2>
                <p className="text-xs sm:text-sm text-ink/70 max-w-md mx-auto">
                  Quản trị viên hệ thống sẽ kiểm tra và phê duyệt yêu cầu cấp lại quyền truy cập cho số điện thoại {phone}.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-line text-xs space-y-3 max-w-md mx-auto">
                <span className="font-semibold text-ink block">Thao tác nhanh cho Ban giám khảo:</span>
                <Link
                  href="/app/admin-demo"
                  className="inline-block px-4 py-2 rounded-lg bg-ink text-paper font-bold hover:bg-ink/90 transition-colors"
                >
                  Mở màn hình Admin Demo để Duyệt ngay ➔
                </Link>
              </div>

              {/* Passkey re-enrollment */}
              <div className="pt-4 border-t border-line space-y-3">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Cấp lại chữ ký Passkey mới:
                </h3>
                {newPasskeyCreated ? (
                  <div className="p-3 rounded-xl bg-primary/15 border border-primary/30 text-xs font-bold text-primary">
                    ✓ Đã cấp và kích hoạt Passkey mới thành công! Bạn có thể quay lại đăng nhập.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateNewPasskey}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-xs disabled:opacity-50"
                  >
                    {loading ? "Đang tạo…" : "Thiết lập Passkey mới trên thiết bị này"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
