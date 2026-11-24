"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/app/session-context";
import { MockBadge } from "@/components/shared";

function sanitizeInternalPath(url: string | null | undefined): string {
  if (!url) return "/app";
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("://") && !url.includes("\\")) {
    return url;
  }
  return "/app";
}

const DEMO_PHONE_MAP: Record<string, { phone: string; role: "LANDLORD" | "TENANT" }> = {
  landlord: { phone: "0900000001", role: "LANDLORD" },
  tenant: { phone: "0900000002", role: "TENANT" },
  tenant1: { phone: "0900000002", role: "TENANT" },
  tenant2: { phone: "0900000003", role: "TENANT" },
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginAs, setUser, isMock } = useSession();

  const demoParam = searchParams.get("demo");
  const initialRole =
    demoParam === "tenant" || demoParam === "tenant1" || demoParam === "tenant2"
      ? "TENANT"
      : "LANDLORD";
  const initialPhone =
    demoParam === "tenant2"
      ? "0900000003"
      : demoParam === "tenant" || demoParam === "tenant1"
        ? "0900000002"
        : "0900000001";

  const [role, setRoleTab] = useState<"LANDLORD" | "TENANT">(initialRole);
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const executeLogin = useCallback(
    async (targetPhone: string, targetCode: string, targetRole: "LANDLORD" | "TENANT" | "ADMIN_DEMO") => {
      setLoading(true);
      setError(null);
      setInfoMessage(null);

      try {
        if (isMock) {
          const userKey =
            targetPhone === "0900000001"
              ? targetRole === "ADMIN_DEMO"
                ? "admin"
                : "landlord"
              : targetPhone === "0900000003"
                ? "tenant2"
                : "tenant1";
          await loginAs(userKey);
          const next = sanitizeInternalPath(searchParams.get("next"));
          router.push(next);
          return;
        }

        const res = await fetch("/api/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: targetPhone,
            code: targetCode,
            role: targetRole,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.error) {
          throw new Error(json.error?.message || "Xác thực OTP thất bại");
        }

        if (json.data?.user) {
          setUser(json.data.user);
        }

        const next = sanitizeInternalPath(searchParams.get("next"));
        if (typeof window !== "undefined") {
          window.location.href = next;
        } else {
          router.push(next);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Đăng nhập không thành công");
      } finally {
        setLoading(false);
      }
    },
    [isMock, loginAs, router, searchParams, setUser],
  );

  useEffect(() => {
    const demo = searchParams.get("demo");
    if (demo && DEMO_PHONE_MAP[demo]) {
      const config = DEMO_PHONE_MAP[demo];
      const timer = setTimeout(() => {
        executeLogin(config.phone, "123456", config.role);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, executeLogin]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setError("Số điện thoại không hợp lệ (tối thiểu 8 chữ số).");
      return;
    }

    setLoading(true);
    try {
      if (isMock) {
        setTimeout(() => {
          setLoading(false);
          setStep("otp");
          setOtp("123456");
        }, 300);
        return;
      }

      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, role }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Không thể tạo mã OTP");
      }

      setStep("otp");
      setInfoMessage(json.data?.message || "Mã OTP mô phỏng đã sẵn sàng.");
      if (cleanPhone === "0900000001" || cleanPhone === "0900000002" || cleanPhone === "0900000003") {
        setOtp("123456");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi gửi yêu cầu OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.trim().length < 4) {
      setError("Vui lòng nhập mã xác thực OTP.");
      return;
    }
    await executeLogin(phone.trim(), otp.trim(), role);
  };

  const handleQuickDemo = (userKey: "landlord" | "tenant1" | "tenant2") => {
    const config = DEMO_PHONE_MAP[userKey];
    if (config) {
      executeLogin(config.phone, "123456", config.role);
    }
  };

  return (
    <main className="min-h-screen bg-paper flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block font-sans text-2xl font-extrabold tracking-tight text-ink">
            <span>Rent</span>
            <span className="text-primary font-black">Flow</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Đăng nhập tài khoản
          </h1>
          <p className="text-xs sm:text-sm text-ink/65">
            Chọn nhanh một vai demo hoặc đăng nhập bằng mã OTP mô phỏng.
          </p>
        </div>

        <div className="rounded-[2rem] border border-line bg-paper p-6 sm:p-8 shadow-soft space-y-6">
          {/* Quick Demo Accounts (Primary fast path for demo) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink/70">Vào nhanh tài khoản demo</span>
              <MockBadge label="MÔ PHỎNG" />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("landlord")}
                disabled={loading}
                className="w-full rounded-2xl border border-line bg-surface/40 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors hover:bg-surface cursor-pointer disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-bold text-ink">Chủ nhà · Nguyễn Văn An</div>
                  <div className="text-xs text-ink/60 font-mono">0900000001</div>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">Vào →</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("tenant1")}
                disabled={loading}
                className="w-full rounded-2xl border border-line bg-surface/40 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors hover:bg-surface cursor-pointer disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-bold text-ink">Người thuê 1 · Trần Thị Bình</div>
                  <div className="text-xs text-ink/60 font-mono">0900000002</div>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">Vào →</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("tenant2")}
                disabled={loading}
                className="w-full rounded-2xl border border-line bg-surface/40 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors hover:bg-surface cursor-pointer disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-bold text-ink">Người thuê 2 · Lê Văn Cường</div>
                  <div className="text-xs text-ink/60 font-mono">0900000003</div>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">Vào →</span>
              </button>
            </div>
          </div>

          <div className="border-t border-line pt-5 space-y-4">
            {/* Role segmented control */}
            <div className="flex rounded-full border border-line bg-surface p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRoleTab("LANDLORD");
                  setPhone("0900000001");
                  setStep("phone");
                }}
                className={`flex-1 rounded-full py-2 transition-colors cursor-pointer ${
                  role === "LANDLORD" ? "bg-paper font-bold text-ink shadow-xs" : "text-ink/60 hover:text-ink"
                }`}
              >
                Chủ nhà
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleTab("TENANT");
                  setPhone("0900000002");
                  setStep("phone");
                }}
                className={`flex-1 rounded-full py-2 transition-colors cursor-pointer ${
                  role === "TENANT" ? "bg-paper font-bold text-ink shadow-xs" : "text-ink/60 hover:text-ink"
                }`}
              >
                Người thuê
              </button>
            </div>

            {infoMessage && (
              <div role="status" className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-xs font-medium text-primary-strong">
                {infoMessage}
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-2xl border border-brick/30 bg-brick/10 p-3 text-xs font-medium text-brick-ink">
                {error}
              </div>
            )}

            {step === "phone" ? (
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0900000001"
                    className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 font-mono text-base text-ink focus:outline-primary"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-ink py-3 text-sm font-bold text-paper transition-colors hover:bg-ink/90 cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Đang gửi mã…" : "Nhận mã xác thực OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-ink/80">
                      Mã OTP (mô phỏng · 123456)
                    </label>
                    <button
                      type="button"
                      onClick={() => setStep("phone")}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Đổi SĐT
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    placeholder="123456"
                    className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 text-center font-mono text-xl tracking-[0.25em] text-ink focus:outline-primary"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-ink py-3 text-sm font-bold text-paper transition-colors hover:bg-ink/90 cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Đang xác thực…" : "Xác nhận & Vào ứng dụng"}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-line/60 pt-4 text-center">
            <Link
              href="/app/khoi-phuc"
              className="text-xs font-medium text-ink/65 hover:text-primary transition-colors underline"
            >
              Khôi phục tài khoản (mô phỏng)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-ink/50">
          Đang tải…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
