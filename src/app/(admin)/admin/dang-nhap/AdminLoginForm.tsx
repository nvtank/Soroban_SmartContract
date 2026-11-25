"use client";

import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { logoutServerAction } from "@/components/app/session-actions";

gsap.registerPlugin(useGSAP);

function adminDestination(next: string | null) {
  if (!next || !/^\/admin(?:[/?#]|$)/.test(next) || /[\\\s]/.test(next)) return "/admin";

  const target = new URL(next, window.location.origin);
  if (
    target.origin !== window.location.origin ||
    !/^\/admin(?:\/|$)/.test(target.pathname) ||
    /%2f|%5c/i.test(target.pathname) ||
    /^\/admin\/dang-nhap(?:\/|$)/.test(target.pathname)
  ) {
    return "/admin";
  }

  return target.pathname + target.search + target.hash;
}

async function authenticate(
  endpoint: "otp/request" | "otp/verify" | "admin/password",
  payload: Record<string, string>,
) {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => null)) as {
    data?: { user?: { role: string } };
    error?: { message?: string };
  } | null;
  if (!response.ok) throw new Error(result?.error?.message ?? "Không thể xác thực. Vui lòng thử lại.");
  return result?.data;
}

const fieldClass =
  "mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink focus:border-primary aria-invalid:border-brick";

export function AdminLoginForm({ passwordEnabled }: { passwordEnabled: boolean }) {
  const searchParams = useSearchParams();
  const cardRef = useRef<HTMLElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(cardRef.current, { opacity: 0, y: 16, duration: 0.45, ease: "power2.out" });
      });
      return () => media.revert();
    },
    { scope: cardRef },
  );

  const enterOtp = step === "otp";

  function changePhone() {
    setStep("phone");
    setError("");
    setCode("");
    requestAnimationFrame(() => phoneRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setError("");
    setPending(true);
    let redirecting = false;

    try {
      if (!passwordEnabled && !enterOtp) {
        await authenticate("otp/request", { phone });
        setStep("otp");
        requestAnimationFrame(() => otpRef.current?.focus());
        return;
      }

      const result = passwordEnabled
        ? await authenticate("admin/password", { username, password })
        : await authenticate("otp/verify", { phone, code });
      if (result?.user?.role !== "ADMIN_DEMO") {
        setError("Tài khoản này không có quyền quản trị");
        setCode("");
        await logoutServerAction();
        return;
      }

      window.location.replace(adminDestination(searchParams.get("next")));
      redirecting = true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      if (!redirecting) {
        setPending(false);
        submittingRef.current = false;
      }
    }
  }

  return (
    <section
      ref={cardRef}
      aria-labelledby="admin-login-heading"
      className="relative w-full max-w-md overflow-hidden rounded-panel border border-line bg-white shadow-soft"
    >
      <div className="h-1.5 bg-linear-to-r from-primary-strong via-primary to-amber" aria-hidden="true" />
      <div className="p-6 sm:p-9">
        <div className="mb-6 flex items-center gap-3 text-sm font-semibold text-primary-strong">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          RentFlow Quản trị
        </div>
        <h1 id="admin-login-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Đăng nhập quản trị
        </h1>
        {!passwordEnabled && (
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            {enterOtp
              ? "Nhập mã OTP để xác minh quyền truy cập."
              : "Xác minh số điện thoại của tài khoản quản trị."}
          </p>
        )}

        <form className="mt-7" method="post" onSubmit={submit} aria-busy={pending}>
          {passwordEnabled ? (
            <div className="space-y-4">
              <label className="block text-sm font-semibold">
                Tên tài khoản
                <input
                  name="username"
                  className={fieldClass}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={64}
                  required
                  readOnly={pending}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                Mật khẩu
                <input
                  name="password"
                  type="password"
                  className={fieldClass}
                  autoComplete="current-password"
                  maxLength={128}
                  required
                  readOnly={pending}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>
          ) : enterOtp ? (
            <>
              <label htmlFor="admin-otp" className="block text-sm font-semibold">
                Mã OTP
              </label>
              <input
                ref={otpRef}
                id="admin-otp"
                className={`${fieldClass} font-mono tracking-[0.3em]`}
                type="password"
                autoComplete="one-time-code"
                spellCheck={false}
                aria-describedby={error ? "admin-login-error" : undefined}
                aria-invalid={Boolean(error)}
                minLength={6}
                size={8}
                maxLength={32}
                required
                readOnly={pending}
                value={code}
                onChange={(event) => setCode(event.target.value.trim())}
              />
            </>
          ) : (
            <>
              <label htmlFor="admin-phone" className="block text-sm font-semibold">
                Số điện thoại
              </label>
              <input
                ref={phoneRef}
                id="admin-phone"
                className={fieldClass}
                type="tel"
                autoComplete="tel"
                aria-describedby={error ? "admin-login-error" : undefined}
                aria-invalid={Boolean(error)}
                minLength={8}
                maxLength={15}
                pattern="[0-9+]{8,15}"
                required
                readOnly={pending}
                value={phone}
                onChange={(event) => setPhone(event.target.value.trim())}
              />
            </>
          )}
          {error && (
            <p
              id="admin-login-error"
              role="alert"
              className="mt-3 rounded-xl bg-brick/10 px-3 py-2 text-sm text-brick-ink"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-strong px-4 py-3 text-sm font-semibold text-white hover:bg-ink disabled:cursor-wait disabled:opacity-70"
          >
            {pending
              ? "Đang xác minh…"
              : passwordEnabled
                ? "Đăng nhập"
                : enterOtp
                  ? "Xác nhận đăng nhập"
                  : "Yêu cầu mã OTP"}
            {!pending && <ArrowRight size={16} aria-hidden="true" />}
          </button>
          {enterOtp && (
            <button
              type="button"
              onClick={changePhone}
              disabled={pending}
              className="mt-3 w-full cursor-pointer rounded-lg py-2 text-sm font-semibold text-primary-strong hover:bg-primary/5 disabled:opacity-70"
            >
              Đổi số điện thoại
            </button>
          )}
        </form>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-sm text-xs font-semibold text-ink/70 hover:text-primary-strong"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Về trang chủ
        </Link>
      </div>
    </section>
  );
}
