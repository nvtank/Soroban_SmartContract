"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { REDUCED, RollText, useMagnetic } from "./island/island-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const CHAPTERS: { id: string; name: string; group: "story" | "how" | null }[] = [
  { id: "mo-dau", name: "Mở đầu", group: null },
  { id: "van-de", name: "Khi niềm tin gãy", group: "story" },
  { id: "giai-phap", name: "Hai chìa khóa", group: "story" },
  { id: "hanh-trinh", name: "Năm bước", group: "how" },
  { id: "on-chain", name: "Dấu vết on-chain", group: "how" },
  { id: "su-that", name: "Thật và mô phỏng", group: "how" },
  { id: "dung-thu", name: "Dùng thử", group: null },
];

const LINKS = [
  { key: "story", hash: "#van-de", label: "Câu chuyện" },
  { key: "how", hash: "#hanh-trinh", label: "Cách hoạt động" },
  { key: "page", href: "/minh-bach", label: "Minh bạch" },
] as const;

function NavbarInner() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const islandRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const chapterBoxRef = useRef<HTMLDivElement>(null);
  const chapterTextRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const barTopRef = useRef<HTMLSpanElement>(null);
  const barBottomRef = useRef<HTMLSpanElement>(null);

  const [chapter, setChapter] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const compactRef = useRef(false);

  useMagnetic(ctaRef, 0.25);

  // Island xuất hiện khi tải trang. Dùng context + revert để chạy hai lần (React dev) vẫn đúng.
  useLayoutEffect(() => {
    const island = islandRef.current;
    if (!island || window.matchMedia(REDUCED).matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        island,
        { y: -36, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.5)" },
      ).fromTo(
        island.querySelectorAll("[data-island-item]"),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 },
        0.25,
      );
    }, island);
    return () => ctx.revert();
  }, []);

  // Thu gọn khi cuộn xuống: ẩn liên kết, hiện tên chương hiện tại. Cuộn lên hoặc rê chuột thì nở ra.
  useEffect(() => {
    const links = linksRef.current;
    const box = chapterBoxRef.current;
    const island = islandRef.current;
    if (!links || !island || window.matchMedia(REDUCED).matches) return;
    const desktop = window.matchMedia("(min-width: 640px)");

    const setCompact = (compact: boolean) => {
      if (compactRef.current === compact || !desktop.matches) return;
      compactRef.current = compact;
      const ease = "power3.inOut";
      if (compact) {
        gsap.to(links, { width: 0, opacity: 0, duration: 0.45, ease, overwrite: true });
        if (box && isHome) {
          gsap.fromTo(
            box,
            { width: 0, opacity: 0 },
            { width: "auto", opacity: 1, duration: 0.45, ease, overwrite: true },
          );
        }
      } else {
        gsap.to(links, {
          width: links.scrollWidth,
          opacity: 1,
          duration: 0.45,
          ease,
          overwrite: true,
          onComplete: () => {
            gsap.set(links, { clearProps: "width" });
          },
        });
        if (box) gsap.to(box, { width: 0, opacity: 0, duration: 0.35, ease, overwrite: true });
      }
    };

    let hovering = false;
    let scrolledDown = false;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const y = self.scroll();
        if (y < 140) scrolledDown = false;
        else if (self.direction === 1) scrolledDown = true;
        else if (self.direction === -1) scrolledDown = false;
        setCompact(scrolledDown && !hovering);
      },
    });
    const enter = () => {
      hovering = true;
      setCompact(false);
    };
    const leave = () => {
      hovering = false;
      setCompact(scrolledDown);
    };
    island.addEventListener("pointerenter", enter);
    island.addEventListener("pointerleave", leave);
    return () => {
      st.kill();
      island.removeEventListener("pointerenter", enter);
      island.removeEventListener("pointerleave", leave);
      compactRef.current = false;
      gsap.set([links, box].filter(Boolean), { clearProps: "width,opacity" });
    };
  }, [isHome]);

  // Theo dõi chương đang đọc trên trang chủ
  useEffect(() => {
    if (!isHome) return;
    const triggers = CHAPTERS.map((c, i) => {
      const el = document.getElementById(c.id);
      if (!el) return null;
      return ScrollTrigger.create({
        trigger: el,
        start: "top center",
        end: "bottom center",
        onToggle: (self) => {
          if (self.isActive) setChapter(i);
        },
      });
    });
    return () => triggers.forEach((t) => t?.kill());
  }, [isHome]);

  // Tên chương đổi bằng hiệu ứng cuộn chữ
  useEffect(() => {
    const el = chapterTextRef.current;
    if (!el || window.matchMedia(REDUCED).matches) return;
    // Island đang thu gọn thì giãn theo độ dài tên chương mới
    if (compactRef.current && chapterBoxRef.current) {
      gsap.to(chapterBoxRef.current, { width: "auto", duration: 0.35, ease: "power3.out", overwrite: true });
    }
    gsap.fromTo(
      el,
      { yPercent: 100, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
    );
  }, [chapter]);

  // Viên sáng trượt theo liên kết đang trỏ
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

  // Menu điện thoại: nút hai vạch thành dấu X, bảng nở từ island
  useEffect(() => {
    const top = barTopRef.current;
    const bottom = barBottomRef.current;
    if (!top || !bottom) return;
    const d = window.matchMedia(REDUCED).matches ? 0 : 0.35;
    gsap.to(top, { y: menuOpen ? 3 : 0, rotation: menuOpen ? 45 : 0, duration: d, ease: "power3.inOut" });
    gsap.to(bottom, {
      y: menuOpen ? -3 : 0,
      rotation: menuOpen ? -45 : 0,
      duration: d,
      ease: "power3.inOut",
    });
    const panel = panelRef.current;
    if (menuOpen && panel && d > 0) {
      gsap.fromTo(
        panel,
        { opacity: 0, y: -14, scale: 0.94, transformOrigin: "top center" },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" },
      );
      gsap.fromTo(
        panel.querySelectorAll("[data-menu-item]"),
        { yPercent: 70, opacity: 0, filter: "blur(6px)" },
        {
          yPercent: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.5,
          stagger: 0.06,
          ease: "power3.out",
          delay: 0.08,
          clearProps: "filter",
        },
      );
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const activeGroup = isHome ? CHAPTERS[chapter]?.group : null;
  const hrefOf = (l: (typeof LINKS)[number]) => ("href" in l ? l.href : isHome ? l.hash : `/${l.hash}`);
  const isActive = (l: (typeof LINKS)[number]) =>
    l.key === "page" ? pathname === l.href : activeGroup === l.key;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3"
      style={{ top: "calc(var(--demo-banner-h, 1.75rem) + 0.625rem)" }}
    >
      <div ref={islandRef} className="pointer-events-auto relative max-w-full">
        <header className="flex items-center gap-1 rounded-full bg-white p-1.5 text-black shadow-[0_14px_36px_-18px_rgba(0,0,0,0.28)] ring-1 ring-black/10">
          <Link
            href="/"
            data-island-item
            className="flex items-center rounded-full py-1.5 pl-3 pr-2.5"
            aria-label="RentFlow - Về trang chủ"
          >
            <span className="text-[15px] font-extrabold tracking-tight">
              Rent<span className="text-primary">Flow</span>
            </span>
          </Link>

          {/* Tên chương: chỉ hiện khi island thu gọn trên trang chủ */}
          <div
            ref={chapterBoxRef}
            className="hidden w-0 overflow-hidden whitespace-nowrap opacity-0 sm:block"
            aria-live="polite"
          >
            <span className="flex w-max items-center gap-2 border-l border-black/10 py-1 pl-3 pr-3 text-[13px] font-semibold text-black/70">
              <span className="font-mono text-[11px] text-primary">0{chapter + 1}</span>
              <span className="inline-flex shrink-0 overflow-hidden">
                <span ref={chapterTextRef} key={chapter} className="block">
                  {CHAPTERS[chapter]?.name}
                </span>
              </span>
            </span>
          </div>

          <nav
            ref={linksRef}
            onMouseLeave={hideHover}
            className="relative hidden items-center overflow-hidden whitespace-nowrap sm:flex"
            aria-label="Điều hướng chính"
          >
            <span
              ref={hoverRef}
              className="pointer-events-none absolute inset-y-0 left-0 w-0 rounded-full bg-black/[0.06] opacity-0"
              aria-hidden="true"
            />
            {LINKS.map((l) => (
              <Link
                key={l.key}
                href={hrefOf(l)}
                data-island-item
                onMouseEnter={(e) => moveHover(e.currentTarget)}
                className={`relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  isActive(l) ? "text-black" : "text-black/80 hover:text-black"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-primary transition-transform duration-300 ${isActive(l) ? "scale-100" : "scale-0"}`}
                  aria-hidden="true"
                />
                <RollText>{l.label}</RollText>
              </Link>
            ))}
          </nav>

          <Link
            ref={ctaRef}
            href="/dang-nhap"
            data-island-item
            className="ml-1 hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-paper shadow-[0_8px_20px_-8px_rgba(20,140,100,0.8)] sm:inline-flex"
          >
            <RollText>Dùng thử</RollText>
            <span aria-hidden="true">→</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-1 flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-full bg-black/[0.06] sm:hidden"
            aria-label={menuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={menuOpen}
            aria-controls="island-menu"
          >
            <span ref={barTopRef} className="block h-[2px] w-4 rounded-full bg-black" />
            <span ref={barBottomRef} className="block h-[2px] w-4 rounded-full bg-black" />
          </button>
        </header>

        {/* Lớp ngoài căn giữa bằng CSS, lớp trong để GSAP tạo hiệu ứng (tránh GSAP ghi đè translate) */}
        {menuOpen && (
          <div className="absolute left-1/2 top-full mt-2 w-[min(22rem,calc(100vw-24px))] -translate-x-1/2 sm:hidden">
            <div
              ref={panelRef}
              id="island-menu"
              className="rounded-[1.75rem] bg-white p-3 text-black shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
            >
              <nav className="flex flex-col" aria-label="Điều hướng di động">
                {LINKS.map((l) => (
                  <Link
                    key={l.key}
                    href={hrefOf(l)}
                    onClick={() => setMenuOpen(false)}
                    data-menu-item
                    className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-2xl font-extrabold tracking-tight hover:bg-black/5"
                  >
                    {l.label}
                    {isActive(l) && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                  </Link>
                ))}
                <Link
                  href="/dang-nhap"
                  onClick={() => setMenuOpen(false)}
                  data-menu-item
                  className="mt-2 rounded-2xl bg-primary px-4 py-3.5 text-center text-base font-bold text-white"
                >
                  Dùng thử
                </Link>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarInner />
    </Suspense>
  );
}
