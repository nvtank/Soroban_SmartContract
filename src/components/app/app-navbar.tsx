"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown } from "lucide-react";
import { useSession } from "./session-context";
import { apiClient } from "./api-client";
import type { NotificationDto } from "@/domain/dto";

export function AppNavbar() {
  const { user, role, loginAs, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getNotifications()
      .then((list) => {
        if (!ignore) {
          setNotifications(list);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!showNotifs && !showUserMenu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNotifs(false);
        setShowUserMenu(false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifs(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [showNotifs, showUserMenu]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.readAt) await apiClient.markNotificationRead(n.id);
    }
    const updated = await apiClient.getNotifications();
    setNotifications(updated);
  };

  const handleQuickSwitch = async (val: "landlord" | "tenant1" | "tenant2") => {
    setShowUserMenu(false);
    await loginAs(val);
    router.refresh();
  };

  const handleTourStart = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rentflow:tour-start"));
    }
  };

  const roleLabel =
    role === "LANDLORD" ? "Chủ nhà" : role === "ADMIN_DEMO" ? "Quản trị" : "Người thuê";

  const cleanName = (user?.fullName || "Tài khoản").replace(/\s*\([^)]*\)\s*/g, "").trim();

  return (
    <header
      className="sticky z-40 w-full px-3 sm:px-6 pt-2.5 pb-1"
      style={{ top: "var(--demo-banner-h, 1.75rem)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-line bg-paper/90 px-3.5 py-1.5 sm:px-5 sm:py-2 shadow-soft backdrop-blur-md">
        {/* Left: Brand & Current Role */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/app"
            className="font-sans text-sm sm:text-base font-extrabold tracking-tight text-ink hover:text-primary transition-colors shrink-0"
          >
            <span>Rent</span>
            <span className="text-primary font-black">Flow</span>
          </Link>

          <span
            className={`hidden sm:inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${
              role === "LANDLORD"
                ? "border-ink/15 bg-ink/6 text-ink"
                : "border-primary/25 bg-primary/10 text-primary-strong"
            }`}
          >
            {roleLabel}
          </span>
        </div>

        {/* Right: Tour trigger, Notifications, User menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            data-tour="nav-tour"
            onClick={handleTourStart}
            className="rounded-full border border-line bg-surface/60 px-2.5 sm:px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-ink/30 hover:bg-surface cursor-pointer"
          >
            Hướng dẫn
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                setShowNotifs((v) => !v);
              }}
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink/75 transition-colors hover:bg-surface hover:text-ink cursor-pointer"
              aria-label="Thông báo"
              aria-expanded={showNotifs}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] font-bold text-paper">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div
                className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto mt-2 sm:w-88 rounded-2xl border border-line bg-paper p-4 shadow-soft z-50"
                data-lenis-prevent
              >
                <div className="flex items-center justify-between border-b border-line pb-2.5 mb-2.5">
                  <span className="text-xs font-bold text-ink">
                    Thông báo {unreadCount > 0 ? `(${unreadCount} mới)` : ""}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Đã đọc hết
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2" data-lenis-prevent>
                  {notifications.length === 0 ? (
                    <p className="py-5 text-center text-xs text-ink/50">Chưa có thông báo mới.</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl border p-2.5 text-xs ${
                          n.readAt
                            ? "border-line/60 bg-surface/25 text-ink/65"
                            : "border-primary/20 bg-primary/6 text-ink"
                        }`}
                      >
                        <div className="font-semibold">{n.title}</div>
                        <div className="mt-0.5 text-ink/70 line-clamp-2">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifs(false);
                setShowUserMenu((v) => !v);
              }}
              className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-surface cursor-pointer"
              aria-label="Menu người dùng"
              aria-expanded={showUserMenu}
            >
              <span className="max-w-28 truncate hidden sm:inline">{cleanName}</span>
              <span className="sm:hidden font-bold">{cleanName.split(" ").pop()?.slice(0, 6) || "Tài khoản"}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink/60" />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-paper p-2 shadow-soft z-50 text-xs"
                data-lenis-prevent
              >
                <div className="px-3 py-2 border-b border-line/60">
                  <div className="font-bold text-ink truncate">{cleanName}</div>
                  <div className="text-[11px] text-ink/55 font-mono">
                    {user?.phone || "—"} · {roleLabel}
                  </div>
                </div>

                <div className="py-1 space-y-0.5">
                  <Link
                    href="/app"
                    onClick={() => setShowUserMenu(false)}
                    className={`block rounded-xl px-3 py-2 font-semibold transition-colors ${
                      pathname === "/app" ? "bg-surface text-ink" : "text-ink/80 hover:bg-surface"
                    }`}
                  >
                    Bảng điều khiển
                  </Link>
                  <Link
                    href="/bang-chung"
                    onClick={() => setShowUserMenu(false)}
                    className={`block rounded-xl px-3 py-2 font-semibold transition-colors ${
                      pathname === "/bang-chung" ? "bg-surface text-ink" : "text-ink/80 hover:bg-surface"
                    }`}
                  >
                    Bằng chứng on-chain
                  </Link>
                  <Link
                    href="/app/khoi-phuc"
                    onClick={() => setShowUserMenu(false)}
                    className={`block rounded-xl px-3 py-2 font-semibold transition-colors ${
                      pathname === "/app/khoi-phuc" ? "bg-surface text-ink" : "text-ink/80 hover:bg-surface"
                    }`}
                  >
                    Khôi phục tài khoản
                  </Link>
                </div>

                <div className="border-t border-line/60 pt-1.5 mt-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink/45">
                    Đổi vai demo
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickSwitch("landlord")}
                    className="w-full text-left rounded-xl px-3 py-1.5 font-medium text-ink/80 hover:bg-surface cursor-pointer"
                  >
                    Chủ nhà · Nguyễn Văn An
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSwitch("tenant1")}
                    className="w-full text-left rounded-xl px-3 py-1.5 font-medium text-ink/80 hover:bg-surface cursor-pointer"
                  >
                    Người thuê 1 · Trần Thị Bình
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSwitch("tenant2")}
                    className="w-full text-left rounded-xl px-3 py-1.5 font-medium text-ink/80 hover:bg-surface cursor-pointer"
                  >
                    Người thuê 2 · Lê Văn Cường
                  </button>
                </div>

                <div className="border-t border-line/60 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 font-semibold text-brick hover:bg-brick/10 transition-colors cursor-pointer"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
