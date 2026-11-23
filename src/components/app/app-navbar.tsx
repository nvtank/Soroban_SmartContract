"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "./session-context";
import { apiClient } from "./api-client";
import type { NotificationDto } from "@/domain/dto";
import { MockBadge } from "@/components/shared";

export function AppNavbar() {
  const { user, role, loginAs, logout, isMock } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    apiClient.getNotifications().then((list) => setNotifications(list));
  }, [pathname]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.readAt) await apiClient.markNotificationRead(n.id);
    }
    const updated = await apiClient.getNotifications();
    setNotifications(updated);
  };

  const handleRoleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "landlord" | "tenant1" | "tenant2" | "admin";
    loginAs(val);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[rgba(251,248,243,0.85)] border-b border-line shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Links */}
        <div className="flex items-center gap-6">
          <Link href="/app" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-xl bg-primary text-paper flex items-center justify-center font-extrabold text-lg shadow-xs group-hover:scale-105 transition-transform">
              R
            </span>
            <span className="font-extrabold text-xl tracking-tight text-ink">
              Rent<span className="text-primary">Flow</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link
              href="/app"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/app"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-ink/70 hover:text-ink hover:bg-surface"
              }`}
            >
              Bảng điều khiển
            </Link>
            {role === "LANDLORD" && (
              <Link
                href="/app/hop-dong/moi"
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === "/app/hop-dong/moi"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-ink/70 hover:text-ink hover:bg-surface"
                }`}
              >
                + Tạo hợp đồng
              </Link>
            )}
            <Link
              href="/bang-chung"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/bang-chung"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-ink/70 hover:text-ink hover:bg-surface"
              }`}
            >
              Bằng chứng On-chain
            </Link>
            <Link
              href="/app/admin-demo"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/app/admin-demo"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-ink/70 hover:text-ink hover:bg-surface"
              }`}
            >
              Admin Demo
            </Link>
          </nav>
        </div>

        {/* Right: Quick Role Switcher, Notifications, User Info */}
        <div className="flex items-center gap-3">
          {/* Quick role switcher dropdown for Ideathon judges */}
          <div className="hidden sm:flex items-center gap-1.5 bg-surface/70 px-2 py-1 rounded-xl border border-line text-xs">
            <span className="text-ink/60 font-medium">Vai trò:</span>
            <select
              value={
                user?.role === "LANDLORD"
                  ? "landlord"
                  : user?.id === "user_tenant_02"
                    ? "tenant2"
                    : user?.role === "ADMIN_DEMO"
                      ? "admin"
                      : "tenant1"
              }
              onChange={handleRoleSwitch}
              className="bg-transparent text-ink font-semibold focus:outline-none cursor-pointer"
              aria-label="Chọn vai trò người dùng"
            >
              <option value="landlord">Chủ nhà (Nguyễn Văn An)</option>
              <option value="tenant1">Người thuê (Trần Thị Bình)</option>
              <option value="tenant2">Người thuê (Lê Văn Cường)</option>
              <option value="admin">Admin Demo</option>
            </select>
          </div>

          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="p-2 rounded-xl text-ink/70 hover:text-ink hover:bg-surface transition-colors relative cursor-pointer"
              aria-label="Thông báo"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brick text-paper text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-card bg-paper border border-line shadow-soft p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
                  <h4 className="font-bold text-ink text-sm">Thông báo ({unreadCount} mới)</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Đã đọc tất cả
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-ink/50 py-4 text-center">Không có thông báo nào.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border text-xs transition-colors ${
                          n.readAt ? "bg-surface/30 border-line text-ink/70" : "bg-primary/5 border-primary/20 text-ink"
                        }`}
                      >
                        <div className="font-semibold mb-0.5">{n.title}</div>
                        <div className="text-ink/70 line-clamp-2">{n.body}</div>
                        <div className="text-[10px] text-ink/40 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User profile / Logout */}
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline text-xs font-semibold text-ink/80">{user?.fullName}</span>
            <button
              onClick={() => {
                logout();
                router.push("/dang-nhap");
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-line hover:bg-surface text-ink/70 hover:text-ink cursor-pointer transition-colors"
              title="Đăng xuất"
            >
              Đăng xuất
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-ink/70 hover:bg-surface"
            aria-label="Mở menu di động"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-line bg-paper px-4 py-3 space-y-2">
          <Link
            href="/app"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-ink font-medium hover:bg-surface"
          >
            Bảng điều khiển
          </Link>
          {role === "LANDLORD" && (
            <Link
              href="/app/hop-dong/moi"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-primary font-semibold hover:bg-surface"
            >
              + Tạo hợp đồng mới
            </Link>
          )}
          <Link
            href="/bang-chung"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-ink font-medium hover:bg-surface"
          >
            Bằng chứng On-chain
          </Link>
          <Link
            href="/app/admin-demo"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-ink font-medium hover:bg-surface"
          >
            Admin Demo
          </Link>
          <div className="pt-2 border-t border-line">
            <label className="text-xs text-ink/60 font-medium block mb-1">Đổi vai trò:</label>
            <select
              value={
                user?.role === "LANDLORD"
                  ? "landlord"
                  : user?.id === "user_tenant_02"
                    ? "tenant2"
                    : user?.role === "ADMIN_DEMO"
                      ? "admin"
                      : "tenant1"
              }
              onChange={(e) => {
                handleRoleSwitch(e);
                setMobileMenuOpen(false);
              }}
              className="w-full bg-surface p-2 rounded-lg border border-line text-sm text-ink"
            >
              <option value="landlord">Chủ nhà (Nguyễn Văn An)</option>
              <option value="tenant1">Người thuê (Trần Thị Bình)</option>
              <option value="tenant2">Người thuê (Lê Văn Cường)</option>
              <option value="admin">Admin Demo</option>
            </select>
          </div>
        </div>
      )}
    </header>
  );
}
