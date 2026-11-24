"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { marketingVi } from "@/i18n/sections/marketing";
import { vi } from "@/i18n/vi";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Menu, X, ArrowUpRight, ShieldCheck } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const NAV_ITEMS = [
  { id: "van-de", label: marketingVi.nav.problem, href: "/#van-de" },
  { id: "giai-phap", label: marketingVi.nav.solution, href: "/#giai-phap" },
  { id: "cach-hoat-dong", label: marketingVi.nav.howItWorks, href: "/#cach-hoat-dong" },
  { id: "blockchain", label: marketingVi.nav.blockchain, href: "/#blockchain" },
  { id: "so-sanh", label: marketingVi.nav.comparison, href: "/#so-sanh" },
  { id: "dung-thu", label: marketingVi.nav.tryIt, href: "/#dung-thu" },
  { id: "minh-bach", label: marketingVi.nav.transparency, href: "/minh-bach" },
];

export function Navbar() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const [activeSection, setActiveSection] = useState<string>("hero");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // ScrollTrigger theo dõi cuộn để cập nhật scaleX, data-compact, data-hidden
  // Không đọc scrollHeight hay gọi setState mỗi frame cuộn!
  useEffect(() => {
    const header = navRef.current;
    const progress = progressBarRef.current;
    if (!header || !progress) return;

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        // 1. Thanh tiến trình scaleX (GPU transform, không gây reflow)
        progress.style.transform = `scaleX(${self.progress})`;

        // 2. data-compact khi cuộn quá 60px
        const isComp = self.scroll() > 60;
        const currentCompact = header.getAttribute("data-compact") === "true";
        if (isComp !== currentCompact) {
          header.setAttribute("data-compact", isComp ? "true" : "false");
        }

        // 3. Smart ẩn/hiện chỉ bằng transform qua data-hidden
        // direction: 1 = cuộn xuống, -1 = cuộn lên
        if (!mobileMenuOpen) {
          const isDown = self.direction === 1 && self.scroll() > 300;
          const currentHidden = header.getAttribute("data-hidden") === "true";
          if (isDown !== currentHidden) {
            header.setAttribute("data-hidden", isDown ? "true" : "false");
          }
        }
      },
    });

    return () => st.kill();
  }, [mobileMenuOpen]);

  // ScrollTrigger quan sát từng section để cập nhật active indicator
  useEffect(() => {
    if (pathname !== "/") return;

    const ctx = gsap.context(() => {
      NAV_ITEMS.forEach((item) => {
        if (item.id === "minh-bach") return;
        const section = document.getElementById(item.id);
        if (section) {
          ScrollTrigger.create({
            trigger: section,
            start: "top center",
            end: "bottom center",
            onEnter: () => setActiveSection(item.id),
            onEnterBack: () => setActiveSection(item.id),
          });
        }
      });
    });

    return () => ctx.revert();
  }, [pathname]);

  const navPositionsRef = useRef<Record<string, { width: number; left: number }>>({});

  // Đo trước vị trí các mục nav trên desktop một lần khi mount và khi resize
  // Tuyệt đối không đọc offsetWidth/offsetLeft trong frame cuộn hoặc khi đổi activeSection!
  useEffect(() => {
    const measureNav = () => {
      const positions: Record<string, { width: number; left: number }> = {};
      NAV_ITEMS.forEach((item) => {
        const el = document.querySelector<HTMLElement>(`[data-nav-id="${item.id}"]`);
        if (el) {
          positions[item.id] = { width: el.offsetWidth, left: el.offsetLeft };
        }
      });
      navPositionsRef.current = positions;

      // Cập nhật ngay vị trí indicator hiện tại
      const currentActive = pathname === "/minh-bach" ? "minh-bach" : activeSection;
      const pos = positions[currentActive];
      const indicator = indicatorRef.current;
      if (pos && indicator) {
        indicator.style.width = `${pos.width}px`;
        indicator.style.transform = `translateX(${pos.left}px)`;
        indicator.style.opacity = "1";
      }
    };

    measureNav();
    window.addEventListener("resize", measureNav, { passive: true });
    return () => window.removeEventListener("resize", measureNav);
  }, [pathname]);

  // Cập nhật vị trí gạch chân trượt (sliding underline indicator) qua GPU transform
  useEffect(() => {
    const currentActive = pathname === "/minh-bach" ? "minh-bach" : activeSection;
    const pos = navPositionsRef.current[currentActive];
    const indicator = indicatorRef.current;
    if (pos && indicator) {
      indicator.style.width = `${pos.width}px`;
      indicator.style.transform = `translateX(${pos.left}px)`;
      indicator.style.opacity = "1";
    } else if (indicator) {
      indicator.style.opacity = "0";
    }
  }, [activeSection, pathname]);

  // GSAP animation cho menu mobile
  useEffect(() => {
    const menu = mobileMenuRef.current;
    if (!menu) return;

    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      gsap.set(menu, { display: "flex" });
      const tl = gsap.timeline();
      tl.fromTo(
        menu,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: "power2.out" }
      ).fromTo(
        menu.querySelectorAll(".mobile-nav-item"),
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.2, stagger: 0.04, ease: "power2.out" },
        "-=0.1"
      );
    } else {
      document.body.style.overflow = "";
      gsap.to(menu, {
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(menu, { display: "none" });
        },
      });
    }
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        ref={navRef}
        data-compact="false"
        data-hidden="false"
        className="fixed left-0 right-0 z-50 py-3 sm:py-4 transition-transform duration-250 ease-out"
        style={{
          top: "var(--demo-banner-h, 2.75rem)",
          backgroundColor: "rgba(251, 248, 243, 0.96)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 focus-visible:rounded-lg"
            aria-label={`${vi.brand.name} - Về trang chủ`}
            data-cursor-hover="true"
          >
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-primary text-paper transition-transform duration-200">
              <svg
                className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:rotate-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2l-2 2m-1-1l-3 3m2 2l-3 3m-2-2l-3 3m2 2l-3 3" />
                <circle cx="7.5" cy="16.5" r="4.5" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans font-extrabold tracking-tight text-ink text-xl sm:text-2xl">
                {vi.brand.name}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="relative hidden items-center gap-1 xl:flex" aria-label="Điều hướng chính">
            {NAV_ITEMS.map((item) => {
              const currentActive = pathname === "/minh-bach" ? "minh-bach" : activeSection;
              const isCurrent = currentActive === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-nav-id={item.id}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                    isCurrent ? "text-primary-strong font-bold" : "text-ink/75 hover:text-ink"
                  }`}
                  data-cursor-hover="true"
                >
                  {item.label}
                </Link>
              );
            })}
            {/* Sliding underline indicator - using left-0 and transform */}
            <div
              ref={indicatorRef}
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-[transform,opacity] duration-200 ease-out"
              aria-hidden="true"
            />
          </nav>

          {/* CTA & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <MagneticButton
              href="/dang-nhap?demo=landlord&next=/app"
              className="hidden sm:inline-flex whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-bold text-paper shadow-sm transition-colors hover:bg-primary-strong focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              ariaLabel={marketingVi.nav.tryDemo}
            >
              <span>{marketingVi.nav.tryDemo}</span>
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </MagneticButton>

            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface/80 text-ink xl:hidden focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={mobileMenuOpen ? marketingVi.nav.closeMenu : marketingVi.nav.openMenu}
              aria-expanded={mobileMenuOpen}
              data-cursor-hover="true"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Thanh tiến trình đọc ở đáy navbar - dùng scaleX */}
        <div
          ref={progressBarRef}
          className="nav-progress-bar"
          aria-hidden="true"
        />
      </header>

      {/* Fullscreen Mobile Menu */}
      <div
        ref={mobileMenuRef}
        className="fixed inset-0 z-40 hidden flex-col justify-between px-6 pt-36 pb-10 text-ink xl:hidden bg-paper"
        aria-modal="true"
        role="dialog"
      >
        <div className="flex flex-col gap-4">
          <span className="text-xs font-bold tracking-widest text-ink/40 uppercase">Danh mục điều hướng</span>
          <nav className="flex flex-col gap-3" aria-label="Điều hướng di động">
            {NAV_ITEMS.map((item, idx) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="mobile-nav-item flex items-center justify-between rounded-xl border border-line/60 bg-surface/50 px-4 py-3 text-lg font-bold text-ink hover:bg-surface"
              >
                <span>{item.label}</span>
                <span className="text-xs font-mono text-ink/40">0{idx + 1}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-line">
          <Link
            href="/dang-nhap?demo=landlord&next=/app"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-paper shadow-md"
          >
            <span>{marketingVi.nav.tryDemo}</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-center gap-2 text-xs text-ink/60">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>{vi.demo.banner}</span>
          </div>
        </div>
      </div>
    </>
  );
}
