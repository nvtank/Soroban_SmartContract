"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSession } from "./session-context";
import { apiClient } from "./api-client";
import type { NotificationDto } from "@/domain/dto";
import { popIn, popOut, REDUCED, RollText } from "@/components/layout/island/island-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Panel = "notifs" | "user" | null;

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" strokeLinejoin="round" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function AppNavbar() {
  const { user, role, loginAs, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [panel, setPanel] = useState<Panel>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const bellRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getNotifications()
      .then((list) => {
        if (!ignore) setNotifications(list);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [pathname]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Island xuất hiện, ẩn khi cuộn xuống và hiện lại khi cuộn lên; vòng logo là tiến độ đọc trang
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || window.matchMedia(REDUCED).matches) return;
    gsap.fromTo(bar, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.4)" });
    let hidden = false;
    const hide = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        // Đang chạy hướng dẫn thì luôn hiện (bước cuối chỉ vào nút Hướng dẫn trên island)
        const touring = document.querySelector('[data-tour-popup="1"]') !== null;
        const shouldHide = !touring && self.direction === 1 && self.scroll() > 160;
        if (shouldHide === hidden) return;
        hidden = shouldHide;
        gsap.to(bar, {
          yPercent: shouldHide ? -140 : 0,
          duration: 0.4,
          ease: "power3.out",
          overwrite: "auto",
        });
      },
    });
    return () => {
      hide.kill();
    };
  }, [pathname]);

  // Chuông lắc và huy hiệu bật lên khi có thông báo chưa đọc
  useEffect(() => {
    if (unreadCount === 0 || window.matchMedia(REDUCED).matches) return;
    if (bellRef.current) {
      gsap.fromTo(
        bellRef.current,
        { rotation: -18 },
        { rotation: 0, duration: 1.4, ease: "elastic.out(1.2, 0.25)", transformOrigin: "50% 15%" },
      );
    }
    if (badgeRef.current)
      gsap.fromTo(badgeRef.current, { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
  }, [unreadCount]);

  // Hiệu ứng mở bảng
  useLayoutEffect(() => {
    if (panel === "notifs") popIn(notifPanelRef.current);
    if (panel === "user") popIn(userPanelRef.current);
  }, [panel]);

  const closePanel = (then?: () => void) => {
    const el = panel === "notifs" ? notifPanelRef.current : panel === "user" ? userPanelRef.current : null;
    popOut(el, () => {
      setPanel(null);
      then?.();
    });
  };

  const togglePanel = (next: Exclude<Panel, null>) => {
    if (panel === next) closePanel();
    else if (panel) closePanel(() => setPanel(next));
    else setPanel(next);
  };

  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const host = panel === "notifs" ? notifRef.current : userMenuRef.current;
      if (host && !host.contains(target)) closePanel();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
    // closePanel đọc panel hiện tại; chỉ cần gắn lại khi panel đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.readAt) await apiClient.markNotificationRead(n.id);
    }
    setNotifications(await apiClient.getNotifications());
  };

  const handleQuickSwitch = (val: "landlord" | "tenant1" | "tenant2") => {
    closePanel(async () => {
      await loginAs(val);
      router.refresh();
    });
  };

  const handleTourStart = () => {
    window.dispatchEvent(new CustomEvent("rentflow:tour-start"));
  };

  const roleLabel = role === "LANDLORD" ? "Chủ nhà" : role === "ADMIN_DEMO" ? "Quản trị" : "Người thuê";
  const cleanName = (user?.fullName || "Tài khoản").replace(/\s*\([^)]*\)\s*/g, "").trim();
  const words = cleanName.split(/\s+/);
  const initials = (
    (words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")
  ).toUpperCase();

  const menuLink = (href: string, label: string) => (
    <Link
      href={href}
      data-pop-item
      onClick={() => closePanel()}
      className={`block rounded-xl px-3 py-2 font-semibold transition-colors ${
        pathname === href ? "bg-surface text-ink" : "text-ink/80 hover:bg-surface"
      }`}
    >
      {label}
    </Link>
  );

  // Viên nền trượt theo liên kết đang trỏ (chỉ transform/opacity của một phần tử nhỏ)
  const moveHover = (target: HTMLElement) => {
    const pill = hoverRef.current;
    if (!pill || window.matchMedia(REDUCED).matches) return;
    gsap.to(pill, {
      x: target.offsetLeft,
      width: target.offsetWidth,
      opacity: 1,
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });
  };
  const hideHover = () => {
    if (hoverRef.current) gsap.to(hoverRef.current, { opacity: 0, duration: 0.25, overwrite: "auto" });
  };

  const NAV_LINKS = [
    {
      href: "/app",
      label: "Bảng điều khiển",
      active: pathname === "/app" || pathname.startsWith("/app/hop-dong"),
    },
    { href: "/bang-chung", label: "Bằng chứng", active: pathname === "/bang-chung" },
  ];

  return (
    <header className="sticky z-40 w-full px-3 pb-1 pt-2.5 sm:px-6" style={{ top: 0 }}>
      <div
        ref={barRef}
        className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full bg-white p-1.5 pl-2 text-black shadow-[0_14px_36px_-18px_rgba(0,0,0,0.28)] ring-1 ring-black/10"
      >
        {/* Trái: logo và vai trò */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/app"
            className="flex shrink-0 items-center rounded-full py-1.5 pl-2.5 pr-1"
            aria-label="RentFlow - Bảng điều khiển"
          >
            <span className="text-[15px] font-extrabold tracking-tight">
              Rent<span className="text-primary">Flow</span>
            </span>
          </Link>
          <span
            className={`hidden shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${
              role === "LANDLORD" ? "bg-black/[0.06] text-black/80" : "bg-primary/10 text-primary-strong"
            }`}
          >
            {roleLabel}
          </span>
        </div>

        {/* Giữa: điều hướng chính (máy tính); trên điện thoại nằm trong menu tài khoản */}
        <nav
          onMouseLeave={hideHover}
          className="relative hidden items-center md:flex"
          aria-label="Điều hướng ứng dụng"
        >
          <span
            ref={hoverRef}
            className="pointer-events-none absolute inset-y-0 left-0 w-0 rounded-full bg-black/[0.06] opacity-0"
            aria-hidden="true"
          />
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onMouseEnter={(e) => moveHover(e.currentTarget)}
              aria-current={l.active ? "page" : undefined}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                l.active ? "text-black" : "text-black/60 hover:text-black"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full bg-primary transition-transform duration-300 ${l.active ? "scale-100" : "scale-0"}`}
                aria-hidden="true"
              />
              <RollText>{l.label}</RollText>
            </Link>
          ))}
        </nav>

        {/* Phải: hướng dẫn, thông báo, tài khoản */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-tour="nav-tour"
            onClick={handleTourStart}
            className="rounded-full px-3 py-2 text-[13px] font-semibold text-black/80 transition-colors hover:bg-black/[0.06] hover:text-black"
          >
            <RollText>Hướng dẫn</RollText>
          </button>

          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => togglePanel("notifs")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.06] hover:text-black"
              aria-label="Thông báo"
              aria-expanded={panel === "notifs"}
            >
              <span ref={bellRef} className="inline-flex">
                <BellIcon />
              </span>
              {unreadCount > 0 && (
                <span
                  ref={badgeRef}
                  className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] font-bold text-paper ring-2 ring-white"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {panel === "notifs" && (
              <div
                ref={notifPanelRef}
                className="fixed left-3 right-3 z-50 mt-3 rounded-3xl bg-paper p-4 text-ink shadow-[0_30px_70px_-30px_rgba(10,18,40,0.55)] ring-1 ring-line sm:absolute sm:left-auto sm:right-0 sm:w-88"
                data-lenis-prevent
              >
                <div className="mb-2.5 flex items-center justify-between border-b border-line pb-2.5">
                  <span className="text-sm font-bold">
                    Thông báo {unreadCount > 0 ? `(${unreadCount} mới)` : ""}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Đã đọc hết
                    </button>
                  )}
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto" data-lenis-prevent>
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-xs text-ink/50">Chưa có thông báo mới.</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        data-pop-item
                        className={`rounded-2xl p-3 text-xs ${n.readAt ? "bg-surface/50 text-ink/60" : "bg-primary/8 text-ink"}`}
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          {!n.readAt && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                              aria-hidden="true"
                            />
                          )}
                          {n.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-ink/65">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => togglePanel("user")}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-black/[0.06] sm:pr-3"
              aria-label="Menu người dùng"
              aria-expanded={panel === "user"}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-extrabold text-paper">
                {initials || "?"}
              </span>
              <span className="hidden max-w-28 truncate text-[13px] font-semibold sm:inline">
                {cleanName}
              </span>
            </button>

            {panel === "user" && (
              <div
                ref={userPanelRef}
                className="absolute right-0 z-50 mt-3 w-64 rounded-3xl bg-paper p-2 text-xs text-ink shadow-[0_30px_70px_-30px_rgba(10,18,40,0.55)] ring-1 ring-line"
                data-lenis-prevent
              >
                <div data-pop-item className="flex items-center gap-3 border-b border-line/60 px-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[12px] font-extrabold text-paper">
                    {initials || "?"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{cleanName}</span>
                    <span className="block font-mono text-[11px] text-ink/55">
                      {user?.phone || "—"} · {roleLabel}
                    </span>
                  </span>
                </div>

                <div className="space-y-0.5 py-1.5">
                  {menuLink("/app", "Bảng điều khiển")}
                  {menuLink("/bang-chung", "Bằng chứng on-chain")}
                  {menuLink("/app/khoi-phuc", "Khôi phục tài khoản")}
                </div>

                <div className="mt-1 border-t border-line/60 pt-1.5">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink/45">
                    Đổi vai demo
                  </div>
                  {(
                    [
                      ["landlord", "Chủ nhà · Nguyễn Văn An"],
                      ["tenant1", "Người thuê 1 · Trần Thị Bình"],
                      ["tenant2", "Người thuê 2 · Lê Văn Cường"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      data-pop-item
                      onClick={() => handleQuickSwitch(key)}
                      className="w-full rounded-xl px-3 py-1.5 text-left font-medium text-ink/80 hover:bg-surface"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-1 border-t border-line/60 pt-1">
                  <button
                    type="button"
                    data-pop-item
                    onClick={() => closePanel(() => logout())}
                    className="w-full rounded-xl px-3 py-2 text-left font-semibold text-brick transition-colors hover:bg-brick/10"
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
