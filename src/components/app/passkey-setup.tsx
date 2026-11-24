"use client";

import { useState } from "react";

/**
 * Đăng ký Passkey thật (WebAuthn) cho tài khoản đang đăng nhập.
 * Phải nằm TRONG ứng dụng vì máy chủ chỉ cấp tùy chọn đăng ký cho người đã có phiên đăng nhập.
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
    <section
      aria-label="Thiết lập Passkey"
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/50 p-4"
    >
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-ink">Thiết lập Passkey để ký các thao tác quan trọng</p>
        <p className="text-xs text-ink/70">
          Ký hợp đồng, duyệt hoàn cọc và chốt tranh chấp bằng vân tay hoặc Face ID, không cần mật khẩu.
        </p>
        {error && (
          <p role="alert" className="text-xs font-semibold text-brick-ink">
            {error}
          </p>
        )}
      </div>
      {state === "done" ? (
        <span className="text-sm font-bold text-primary-strong">Đã kích hoạt Passkey trên thiết bị này</span>
      ) : (
        <button
          type="button"
          onClick={register}
          disabled={state === "loading"}
          className="rounded-lg border border-primary px-4 py-2 text-sm font-bold text-primary-strong hover:bg-primary/10 disabled:opacity-60"
        >
          {state === "loading" ? "Đang xử lý…" : "Đăng ký Passkey"}
        </button>
      )}
    </section>
  );
}
