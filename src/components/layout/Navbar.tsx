"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Menu, X } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const CHAPTER_GROUPS: Record<"story" | "how", string[]> = {
  story: ["mo-dau", "van-de", "giai-phap"],
  how: ["hanh-trinh", "on-chain", "su-that", "dung-thu"],
};

function NavbarInner() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const navRef = useRef<HTMLElement>(null);
  const hoverPillRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const [activeSectionGroup, setActiveSectionGroup] = useState<"story" | "how" | null>(null);
  const activeGroup = isHome ? activeSectionGroup : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key or outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Entrance animation & Smart scroll hide/show with GSAP
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      // Entrance animation
      gsap.fromTo(
        nav,
        { y: -16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" }
      );
    }

    if (prefersReducedMotion) return;

    // ScrollTrigger to hide when scrolling down, reveal when scrolling up
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        // Do not hide if mobile menu is open
        if (mobileMenuOpen) return;

        const isDown = self.direction === 1 && self.scroll() > 120;
        if (isDown) {
          gsap.to(nav, {
            y: -70,
            opacity: 0,
            duration: 0.2,
            ease: "power2.out",
            overwrite: "auto",
          });
        } else {
          gsap.to(nav, {
            y: 0,
            opacity: 1,
            duration: 0.25,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
      },
    });

    return () => st.kill();
  }, [mobileMenuOpen]);

  // Active chapter tracking on homepage
  useEffect(() => {
    if (!isHome) return;

    const allChapterIds = [...CHAPTER_GROUPS.story, ...CHAPTER_GROUPS.how];
    const ctx = gsap.context(() => {
      allChapterIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        ScrollTrigger.create({
          trigger: el,
          start: "top center",
          end: "bottom center",
          onEnter: () => {
            if (CHAPTER_GROUPS.story.includes(id)) {
              setActiveSectionGroup("story");
            } else if (CHAPTER_GROUPS.how.includes(id)) {
              setActiveSectionGroup("how");
            }
          },
          onEnterBack: () => {
            if (CHAPTER_GROUPS.story.includes(id)) {
              setActiveSectionGroup("story");
            } else if (CHAPTER_GROUPS.how.includes(id)) {
              setActiveSectionGroup("how");
            }
          },
        });
      });
    });

    return () => ctx.revert();
  }, [isHome]);

  // Hover sliding background for desktop links (uses GPU transform, no layout polling on scroll)
  const handleLinkMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pill = hoverPillRef.current;
    const el = e.currentTarget;
    if (!pill || !el) return;

    gsap.to(pill, {
      x: el.offsetLeft,
      width: el.offsetWidth,
      opacity: 1,
      duration: 0.2,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, []);

  const handleNavMouseLeave = useCallback(() => {
    const pill = hoverPillRef.current;
    if (!pill) return;
    gsap.to(pill, {
      opacity: 0,
      duration: 0.15,
      ease: "power2.in",
      overwrite: "auto",
    });
  }, []);

  const isTransparency = pathname === "/minh-bach";

  return (
    <>
      <header
        ref={navRef}
        className="fixed left-1/2 -translate-x-1/2 z-50 w-auto max-w-[calc(100vw-24px)]"
        style={{
          top: "calc(var(--demo-banner-h, 1.75rem) + 0.625rem)",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 rounded-full border border-line bg-paper/90 px-3.5 py-1.5 shadow-soft backdrop-blur-md">
          {/* Logo chữ RentFlow */}
          <Link
            href="/"
            className="font-sans text-sm sm:text-base font-extrabold tracking-tight text-ink hover:text-primary transition-colors px-1"
            aria-label="RentFlow - Về trang chủ"
          >
            <span>Rent</span>
            <span className="text-primary font-black">Flow</span>
          </Link>

          {/* Desktop Links (3 liên kết) */}
          <nav
            onMouseLeave={handleNavMouseLeave}
            className="relative hidden sm:flex items-center gap-0.5"
            aria-label="Điều hướng chính"
          >
            {/* Sliding hover pill */}
            <div
              ref={hoverPillRef}
              className="pointer-events-none absolute inset-y-0.5 rounded-full bg-surface opacity-0"
              aria-hidden="true"
            />

            {/* 1. Câu chuyện */}
            <Link
              href={isHome ? "#van-de" : "/#van-de"}
              onMouseEnter={handleLinkMouseEnter}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeGroup === "story"
                  ? "text-primary font-bold"
                  : "text-ink/75 hover:text-ink"
              }`}
            >
              {activeGroup === "story" && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
              <span>Câu chuyện</span>
            </Link>

            {/* 2. Cách hoạt động */}
            <Link
              href={isHome ? "#hanh-trinh" : "/#hanh-trinh"}
              onMouseEnter={handleLinkMouseEnter}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeGroup === "how"
                  ? "text-primary font-bold"
                  : "text-ink/75 hover:text-ink"
              }`}
            >
              {activeGroup === "how" && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
              <span>Cách hoạt động</span>
            </Link>

            {/* 3. Minh bạch */}
            <Link
              href="/minh-bach"
              onMouseEnter={handleLinkMouseEnter}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isTransparency
                  ? "text-primary font-bold"
                  : "text-ink/75 hover:text-ink"
              }`}
            >
              {isTransparency && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
              <span>Minh bạch</span>
            </Link>
          </nav>

          {/* Nút Dùng thử (Desktop) */}
          <Link
            href="/dang-nhap"
            className="hidden sm:inline-flex items-center rounded-full bg-primary px-3.5 py-1 text-xs font-bold text-paper shadow-xs transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-primary"
          >
            Dùng thử
          </Link>

          {/* Nút Menu (Mobile) */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink sm:hidden hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={mobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Bảng menu di động nhỏ dạng popover nổi (Mobile 390px) */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-nav-panel"
          role="dialog"
          aria-label="Menu điều hướng di động"
          className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-32px)] max-w-xs rounded-2xl border border-line bg-paper/95 p-3.5 shadow-elevated backdrop-blur-md sm:hidden animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: "calc(var(--demo-banner-h, 1.75rem) + 3.25rem)",
          }}
        >
          <nav className="flex flex-col gap-1" aria-label="Điều hướng di động">
            <Link
              href={isHome ? "#van-de" : "/#van-de"}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                activeGroup === "story" ? "bg-primary/10 text-primary font-bold" : "text-ink hover:bg-surface"
              }`}
            >
              <span>Câu chuyện</span>
              {activeGroup === "story" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>

            <Link
              href={isHome ? "#hanh-trinh" : "/#hanh-trinh"}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                activeGroup === "how" ? "bg-primary/10 text-primary font-bold" : "text-ink hover:bg-surface"
              }`}
            >
              <span>Cách hoạt động</span>
              {activeGroup === "how" && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>

            <Link
              href="/minh-bach"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                isTransparency ? "bg-primary/10 text-primary font-bold" : "text-ink hover:bg-surface"
              }`}
            >
              <span>Minh bạch</span>
              {isTransparency && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>

            <div className="pt-2 mt-1 border-t border-line/60">
              <Link
                href="/dang-nhap"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center rounded-xl bg-primary py-2 text-sm font-bold text-paper shadow-xs hover:bg-primary-strong transition-colors"
              >
                Dùng thử
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarInner />
    </Suspense>
  );
}
