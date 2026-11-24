"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/** Banner mô phỏng gọn nhẹ, bắt buộc giữ role="note" và luôn hiện trên mọi trang */
export function DemoBanner() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--demo-banner-h", `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--demo-banner-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      role="note"
      title="Bản demo: ngân hàng và giải ngân là mô phỏng. Blockchain chạy trên Stellar Testnet, không có giá trị tiền thật."
      className="sticky top-0 z-[60] w-full border-b border-line/60 bg-surface/90 py-1 px-3 text-center text-[11px] sm:text-xs font-medium text-ink/75 backdrop-blur-xs select-none"
    >
      <span>Bản demo · Ngân hàng và giải ngân là mô phỏng · Stellar Testnet</span>
      <span className="hidden sm:inline text-ink/40"> — </span>
      <Link
        href="/minh-bach"
        className="hidden sm:inline text-primary hover:underline transition-colors font-semibold ml-1"
      >
        Minh bạch
      </Link>
    </div>
  );
}
