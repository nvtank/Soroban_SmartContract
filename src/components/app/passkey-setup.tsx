"use client";

import { useState } from "react";

/**
 * Đăng ký Passkey thật (WebAuthn) cho tài khoản đang đăng nhập.
 */
export function PasskeySetup() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setState("loading");
    setError(null);
    try {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        throw new Error("Trình duyệt này không hỗ trợ Passkey.");
      }
      const optRes = await fetch("/api/auth/passkey/register/options", { method: "POST" });
      const optJson = await optRes.json().catch(() => ({}));
      if (!optRes.ok || optJson.error) {
        throw new Error(optJson.error?.message || "Chưa thể khởi tạo đăng ký Passkey lúc này.");
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
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký Passkey không thành công.");
      setState("idle");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-ink">
          Passkey ký giao dịch
          <span className="font-normal text-ink/60"> · Dùng vân tay hoặc thiết bị để ký hợp đồng và hoàn cọc.</span>
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-brick-ink">
            {error}
          </p>
        )}
      </div>
      {state === "done" ? (
        <span className="text-xs font-bold text-primary-strong">Đã kích hoạt</span>
      ) : (
        <button
          type="button"
          onClick={register}
          disabled={state === "loading"}
          className="rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink/30 hover:bg-surface disabled:opacity-60 cursor-pointer shrink-0"
        >
          {state === "loading" ? "Đang xử lý…" : "Đăng ký Passkey"}
        </button>
      )}
    </div>
  );
}
