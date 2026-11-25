"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, House, LogOut, Menu, UserRound } from "lucide-react";
import { logoutServerAction } from "@/components/app/session-actions";

const systemTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function SystemClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setTime(new Date());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <time
      dateTime={time?.toISOString()}
      title="Giờ hệ thống · Việt Nam (UTC+7)"
      className="min-w-[8ch] text-center font-mono text-[11px] text-ink/70 tabular-nums sm:text-xs"
    >
      {time ? systemTime.format(time) : "--:--:--"}
    </time>
  );
}

export function AdminTopBar({ title, onOpenNav }: { title: string; onOpenNav: () => void }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const menuButtonRef = useRef<HTMLElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    function dismissMenu(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    document.addEventListener("pointerdown", dismissMenu);
    return () => document.removeEventListener("pointerdown", dismissMenu);
  }, []);

  async function logout() {
    setPending(true);
    setError(false);
    try {
      await logoutServerAction();
      window.location.replace("/admin/dang-nhap");
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <header className="sticky top-(--demo-banner-h) z-30 flex min-h-16 min-w-0 items-center justify-between gap-2 border-b border-line bg-white/95 px-3 backdrop-blur-sm sm:gap-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Mở điều hướng"
          aria-haspopup="dialog"
          aria-controls="admin-nav-drawer"
          onClick={onOpenNav}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line hover:bg-surface lg:hidden"
        >
          <Menu size={19} aria-hidden="true" />
        </button>
        <span className="truncate text-sm font-bold sm:text-base">{title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <Link
          href="/admin/truc-tiep"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-[11px] leading-tight font-semibold whitespace-nowrap text-primary-strong hover:bg-primary/15 sm:px-3 sm:text-xs"
        >
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
          Trực tiếp
        </Link>
        <SystemClock />
        <details
          ref={menuRef}
          className="relative"
          onKeyDown={(event) => {
            if (event.key === "Escape" && menuRef.current?.open) {
              menuRef.current.open = false;
              menuButtonRef.current?.focus();
            }
          }}
        >
          <summary
            ref={menuButtonRef}
            aria-label="Tài khoản quản trị"
            className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-surface [&::-webkit-details-marker]:hidden sm:px-3"
          >
            <UserRound size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Quản trị viên</span>
            <ChevronDown size={14} aria-hidden="true" className="hidden sm:block" />
          </summary>
          <div className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-soft">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface"
            >
              <House size={16} aria-hidden="true" /> Về trang chủ
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={logout}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-brick-ink hover:bg-brick/10 disabled:opacity-60"
            >
              <LogOut size={16} aria-hidden="true" /> {pending ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
            {error && (
              <p role="alert" className="px-3 py-2 text-xs text-brick-ink">
                Đăng xuất thất bại. Vui lòng thử lại.
              </p>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
