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
    demoParam === "tenant" || demoParam === "tenant1" || demoParam === "tenant2" ? "TENANT" : "LANDLORD";
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

  // Quick login handler
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

  // Auto-login when safe ?demo=... is provided
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
      setInfoMessage(json.data?.message || "Mã OTP đã được tạo thành công.");
      // In demo mode for fixed numbers, prefill OTP for convenience
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
    <main className="min-h-screen bg-paper flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link href="/app" className="inline-flex items-center gap-2 group">
          <span className="w-10 h-10 rounded-2xl bg-primary text-paper flex items-center justify-center font-black text-2xl shadow-xs">
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
                setPhone("0900000001");
                setStep("phone");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                role === "LANDLORD" ? "bg-primary text-paper shadow-xs" : "text-ink/60 hover:text-ink"
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
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                role === "TENANT" ? "bg-primary text-paper shadow-xs" : "text-ink/60 hover:text-ink"
              }`}
            >
              Người thuê
            </button>
          </div>

          {infoMessage && (
            <div
              role="status"
              className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium"
            >
              {infoMessage}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-brick/10 border border-brick/30 text-brick text-xs font-medium"
            >
              {error}
            </div>
          )}

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
                  placeholder="Ví dụ: 0900000001"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-base focus:outline-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs disabled:opacity-50"
              >
                {loading ? "Đang gửi mã…" : "Nhận mã xác thực OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink">Mã xác thực OTP</label>
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
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-center tracking-widest text-xl font-mono focus:outline-primary"
                  required
                />
                <p className="text-[11px] text-ink/50 mt-1.5 text-center">
                  Mã OTP cho tài khoản thử nghiệm demo: <strong>123456</strong>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs disabled:opacity-50"
              >
                {loading ? "Đang xác thực…" : "Xác nhận & Vào ứng dụng"}
              </button>
            </form>
          )}

          {/* Passkey registration callout */}
          <p className="text-xs text-ink/60">
            Sau khi đăng nhập, bạn có thể thiết lập Passkey ở bảng điều khiển để ký các thao tác quan trọng.
          </p>

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
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl bg-paper hover:bg-surface border border-line text-left flex items-center justify-between cursor-pointer transition-colors group disabled:opacity-50"
              >
                <div>
                  <div className="text-xs font-bold text-ink group-hover:text-primary">
                    Chủ nhà: Nguyễn Văn An
                  </div>
                  <div className="text-[11px] text-ink/60">0900000001 • Quản lý phòng & tạo hợp đồng</div>
                </div>
                <span className="text-xs text-primary font-bold">Vào ➔</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("tenant1")}
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl bg-paper hover:bg-surface border border-line text-left flex items-center justify-between cursor-pointer transition-colors group disabled:opacity-50"
              >
                <div>
                  <div className="text-xs font-bold text-ink group-hover:text-primary">
                    Người thuê 1: Trần Thị Bình
                  </div>
                  <div className="text-[11px] text-ink/60">0900000002 • Ký xác nhận & nạp cọc</div>
                </div>
                <span className="text-xs text-primary font-bold">Vào ➔</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("tenant2")}
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl bg-paper hover:bg-surface border border-line text-left flex items-center justify-between cursor-pointer transition-colors group disabled:opacity-50"
              >
                <div>
                  <div className="text-xs font-bold text-ink group-hover:text-primary">
                    Người thuê 2: Lê Văn Cường
                  </div>
                  <div className="text-[11px] text-ink/60">0900000003 • Có kỳ thuê quá hạn</div>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-ink/50">Đang tải…</div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
