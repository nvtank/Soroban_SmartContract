"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };

/** Có chuyển động (người dùng không bật giảm chuyển động). */
export const MOTION = "(prefers-reduced-motion: no-preference)";
/** Có chuyển động và màn hình đủ rộng để ghim cuộn. */
export const DESKTOP_MOTION = "(prefers-reduced-motion: no-preference) and (min-width: 1024px)";
/** Có chuột thật để dùng hiệu ứng hover. */
export const HOVER = "(hover: hover) and (pointer: fine)";

/** Khung chung để mọi chương thẳng lề với nhau. */
export const WRAP = "mx-auto w-full max-w-6xl px-6 lg:px-10";

/**
 * Tiêu đề chương hiện từ mờ sang rõ theo từng từ khi cuộn tới.
 * Blur chỉ áp lên chữ tiêu đề, trong thời gian ngắn, để không làm nặng việc cuộn.
 */
export function revealTitle(el: Element | null, trigger?: Element | null) {
  if (!el) return;
  const split = new SplitText(el, { type: "words", wordsClass: "inline-block will-change-transform" });
  gsap.from(split.words, {
    yPercent: 60,
    opacity: 0,
    filter: "blur(8px)",
    duration: 0.8,
    ease: "power3.out",
    stagger: 0.05,
    clearProps: "filter",
    scrollTrigger: { trigger: trigger ?? el, start: "top 80%", once: true },
  });
}
