"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/app/session-context";
import { MockBadge } from "@/components/shared";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginAs } = useSession();

  const demoParam = searchParams.get("demo");
  const initialRole =
    demoParam === "tenant" || demoParam === "tenant1" || demoParam === "tenant2" ? "TENANT" : "LANDLORD";
  const initialPhone =
    demoParam === "tenant2"
      ? "0912345678"
      : demoParam === "tenant" || demoParam === "tenant1"
        ? "0987654321"
        : "0901234567";

  const [role, setRoleTab] = useState<"LANDLORD" | "TENANT">(initialRole);
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);

  // Auto-login and redirect when ?demo=... is present
  useEffect(() => {
    const demo = searchParams.get("demo");
    const nextParam = searchParams.get("next");

    if (demo) {
      const userKey =
        demo === "landlord"
          ? "landlord"
          : demo === "tenant2"
            ? "tenant2"
            : "tenant1";
      loginAs(userKey);
      if (nextParam) {
        router.push(nextParam);
      }
    }
  }, [searchParams, loginAs, router]);

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone || phone.length < 10) {
      setError("Số điện thoại không hợp lệ (cần ít nhất 10 số bắt đầu bằng 0).");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
      setOtp("123456"); // Pre-fill for easy demo
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.length < 6) {
      setError("Vui lòng nhập đủ 6 chữ số mã xác thực OTP.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Map to demo user
      if (role === "LANDLORD") {
        loginAs("landlord");
      } else {
        loginAs("tenant1");
      }
      const nextParam = searchParams.get("next");
      router.push(nextParam || "/app");
    }, 600);
  };

  const handleQuickDemo = (userKey: "landlord" | "tenant1" | "tenant2") => {
    loginAs(userKey);
    const nextParam = searchParams.get("next");
    router.push(nextParam || "/app");
  };

  const handleRegisterPasskey = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setPasskeyRegistered(true);
    }, 800);
  };

  return (
    <main className="min-h-screen bg-paper flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/app" className="inline-flex items-center gap-2 group">
          <span className="w-10 h-10 rounded-2xl bg-primary text-paper flex items-center justify-center font-black text-2xl shadow-sm">
            R
          </span>
          <span className="font-extrabold text-2xl sm:text-3xl tracking-tight text-ink">
            Rent<span className="text-primary">Flow</span>
          </span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Đăng nhập tài khoản</h1>
        <p className="text-xs sm:text-sm text-ink/70">
          Dịch vụ bảo chứng tiền cọc và quản lý thuê nhà minh bạch
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface/50 py-8 px-6 sm:px-10 rounded-panel border border-line shadow-soft space-y-6">
          {/* Role selector tabs */}
          <div className="flex rounded-xl bg-paper p-1 border border-line">
            <button
              type="button"
              onClick={() => {
                setRoleTab("LANDLORD");
                setPhone("0901234567");
                setStep("phone");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                role === "LANDLORD"
                  ? "bg-primary text-paper shadow-xs"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              Chủ nhà
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("TENANT");
                setPhone("0987654321");
                setStep("phone");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                role === "TENANT"
                  ? "bg-primary text-paper shadow-xs"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              Người thuê
            </button>
          </div>

          {/* Form */}
          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0901234567"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-base focus:outline-primary transition-all"
                  required
                />
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-lg bg-brick/10 border border-brick/30 text-brick text-xs font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
              >
                {loading ? "Đang gửi mã…" : "Nhận mã xác thực OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink">
                    Mã xác thực OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Đổi SĐT ({phone})
                  </button>
                </div>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="123456"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-center tracking-widest text-xl font-mono focus:outline-primary transition-all"
                  required
                />
                <p className="text-[11px] text-ink/50 mt-1.5 text-center">
                  Mã OTP mô phỏng cho bản demo: <strong>123456</strong>
                </p>
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-lg bg-brick/10 border border-brick/30 text-brick text-xs font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
              >
                {loading ? "Đang xác thực…" : "Xác nhận & Vào ứng dụng"}
              </button>
            </form>
          )}

          {/* Passkey registration callout */}
          <div className="p-3.5 rounded-xl bg-paper border border-line text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-ink">
              <span>Thiết lập chữ ký Passkey</span>
              <MockBadge label="KHUYÊN DÙNG" />
            </div>
            <p className="text-ink/70 text-[11px]">
              Ký hợp đồng và xác nhận giải ngân an toàn không cần mật khẩu với công nghệ WebAuthn.
            </p>
            {passkeyRegistered ? (
              <div className="text-primary font-bold text-xs flex items-center gap-1">
                <span>✓</span> Đã kích hoạt Passkey trên thiết bị này
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegisterPasskey}
                disabled={loading}
                className="w-full py-1.5 rounded-lg bg-surface hover:bg-line/20 text-ink font-semibold border border-line transition-colors cursor-pointer text-xs"
              >
                {loading ? "Đang đăng ký…" : "Đăng ký Passkey cho tài khoản"}
              </button>
            )}
          </div>

          {/* Quick Demo Login section for competition judges */}
          <div className="border-t border-line pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Đăng nhập nhanh cho ban giám khảo:
              </span>
              <MockBadge label="DEMO ACCOUNTS" />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("landlord")}
                className="w-full py-2 px-3 rounded-xl bg-paper hover:bg-surface border border-line text-left flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div>
                  <div className="text-xs font-bold text-ink group-hover:text-primary">
                    Chủ nhà: Nguyễn Văn An
                  </div>
                  <div className="text-[11px] text-ink/60">0901234567 • Quản lý phòng & tạo hợp đồng</div>
                </div>
                <span className="text-xs text-primary font-bold">Vào ➔</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("tenant1")}
                className="w-full py-2 px-3 rounded-xl bg-paper hover:bg-surface border border-line text-left flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div>
                  <div className="text-xs font-bold text-ink group-hover:text-primary">
                    Người thuê 1: Trần Thị Bình
                  </div>
                  <div className="text-[11px] text-ink/60">0987654321 • Ký xác nhận & nạp cọc</div>
                </div>
                <span className="text-xs text-primary font-bold">Vào ➔</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("tenant2")}
                className="w-full py-2 px-3 rounded-xl bg-paper hover:bg-surface border border-line text-left flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div>
                  <div className="text-xs font-bold text-ink group-hover:text-primary">
                    Người thuê 2: Lê Văn Cường
                  </div>
                  <div className="text-[11px] text-ink/60">0912345678 • Có kỳ thuê quá hạn</div>
                </div>
                <span className="text-xs text-primary font-bold">Vào ➔</span>
              </button>
            </div>
          </div>

          {/* Account recovery link */}
          <div className="text-center pt-2 border-t border-line">
            <Link
              href="/app/khoi-phuc"
              className="text-xs text-ink/70 hover:text-primary transition-colors underline"
            >
              Mất thiết bị hoặc đổi số điện thoại? Khôi phục tài khoản (Mô phỏng)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-ink/50">Đang tải…</div>}>
      <LoginContent />
    </Suspense>
  );
}
