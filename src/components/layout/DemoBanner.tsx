"use client";

import { useEffect, useRef } from "react";
import { vi } from "@/i18n/vi";

/** Banner bắt buộc luôn hiển thị. Chiều cao được chia sẻ để navbar nằm ngay bên dưới. */
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
    <div ref={ref} role="note" className="sticky top-0 z-[60] bg-ink px-4 py-2 text-center text-base text-paper">
      {vi.demo.banner}
    </div>
  );
}
