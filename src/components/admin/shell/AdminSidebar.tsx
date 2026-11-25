"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Link2,
  Settings2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import gsap from "gsap";

const navGroups = [
  {
    label: "Bảng điều khiển",
    items: [
      { segment: null, label: "Tổng quan", icon: LayoutDashboard },
      { segment: "truc-tiep", label: "Trực tiếp", icon: Activity },
    ],
  },
  {
    label: "Theo dõi",
    items: [
      { segment: "nguoi-dung", label: "Người dùng", icon: UsersRound },
      { segment: "hop-dong", label: "Hợp đồng", icon: FileText },
      { segment: "thanh-toan", label: "Thanh toán", icon: CreditCard },
      { segment: "on-chain", label: "On-chain", icon: Link2 },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { segment: "nhat-ky", label: "Nhật ký", icon: History },
      { segment: "khoi-phuc", label: "Khôi phục", icon: UserRoundCheck },
      { segment: "he-thong", label: "Hệ thống", icon: Settings2 },
    ],
  },
];

export function adminSectionTitle(segment: string | null) {
  return (
    navGroups.flatMap(({ items }) => items).find((item) => item.segment === segment)?.label ?? "Quản trị"
  );
}

export function AdminSidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${compact ? "justify-center" : ""}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-strong text-white">
        <ShieldCheck size={21} aria-hidden="true" />
      </span>
      <div className={compact ? "sr-only" : "leading-snug"}>
        <p className="text-sm font-bold tracking-tight">RentFlow</p>
        <p className="text-xs font-medium text-ink/65">Quản trị</p>
      </div>
    </div>
  );
}

export function AdminSidebarNav({
  segment,
  compact = false,
  onNavigate,
}: {
  segment: string | null;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const positionedRef = useRef(false);

  useEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    const active = nav?.querySelector<HTMLAnchorElement>("[aria-current='page']");
    if (!nav || !indicator) return;

    if (!active) {
      gsap.set(indicator, { opacity: 0 });
      positionedRef.current = false;
      return;
    }

    let lastOffset: number | undefined;
    function position() {
      if (!nav || !indicator || !active || !nav.offsetHeight) return;
      const offset = active.offsetTop + (active.offsetHeight - indicator.offsetHeight) / 2;
      if (offset === lastOffset) return;
      lastOffset = offset;

      const options = { y: offset, opacity: 1, overwrite: true };
      if (!positionedRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(indicator, options);
      } else {
        gsap.to(indicator, { ...options, duration: 0.24, ease: "power2.out" });
      }
      positionedRef.current = true;
    }
    position();

    const observer = new ResizeObserver(position);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      gsap.killTweensOf(indicator);
    };
  }, [segment, compact]);

  return (
    <nav ref={navRef} aria-label="Điều hướng quản trị" className="relative space-y-4 px-3">
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-3 z-10 h-5 w-[3px] rounded-r-full bg-primary-strong opacity-0"
      />
      {navGroups.map(({ label, items }) => (
        <div
          key={label}
          className={compact ? "border-t border-line pt-3 first:border-0 first:pt-0" : undefined}
        >
          <p
            className={
              compact
                ? "sr-only"
                : "mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-ink/65 uppercase"
            }
          >
            {label}
          </p>
          <ul aria-label={label} className="space-y-1">
            {items.map(({ segment: itemSegment, label: itemLabel, icon: Icon }) => (
              <li key={itemLabel}>
                <Link
                  href={itemSegment ? `/admin/${itemSegment}` : "/admin"}
                  aria-current={segment === itemSegment ? "page" : undefined}
                  title={compact ? itemLabel : undefined}
                  onNavigate={onNavigate}
                  className={`flex min-h-10 items-center gap-3 rounded-lg text-sm font-semibold text-ink/75 hover:bg-surface aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary-strong ${compact ? "justify-center" : "px-3"}`}
                >
                  <Icon size={18} className="shrink-0" aria-hidden="true" />
                  <span className={compact ? "sr-only" : undefined}>{itemLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
