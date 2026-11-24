"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { gsap, HOVER, MOTION, SplitText, WRAP } from "./motion";

const copy = marketingVi.landing.hero;

/** Chiếc chìa khóa: hình ảnh xuyên suốt câu chuyện. */
export function KeyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 120" className={className} fill="none" aria-hidden="true">
      <circle cx="60" cy="60" r="42" stroke="currentColor" strokeWidth="10" />
      <circle cx="60" cy="60" r="14" className="fill-primary" />
      <path d="M102 60H296" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M240 60v26M268 60v18M296 60v30" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const lines = gsap.utils.toArray<HTMLElement>("[data-line]");
        const splits = lines.map((line) => new SplitText(line, { type: "words", wordsClass: "inline-block" }));
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(
          splits.flatMap((s) => s.words),
          { yPercent: 80, opacity: 0, filter: "blur(10px)", duration: 1, stagger: 0.07, clearProps: "filter" },
        )
          .from("[data-key]", { xPercent: 40, rotation: 70, opacity: 0, duration: 1.2 }, 0.15)
          .from("[data-fade]", { y: 24, opacity: 0, duration: 0.7, stagger: 0.1 }, 0.6);

        // Cuộn xuống: chìa khóa xoay như đang mở khóa và rơi dần sang chương sau
        gsap.to("[data-key-scroll]", {
          rotation: -90,
          yPercent: 60,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: 0.6 },
        });
      });

      // Hover: chìa khóa nghiêng theo con trỏ
      mm.add(`${MOTION} and ${HOVER}`, () => {
        const target = root.current?.querySelector("[data-key]");
        if (!target) return;
        const rotate = gsap.quickTo(target, "rotation", { duration: 0.6, ease: "power3.out" });
        const shift = gsap.quickTo(target, "x", { duration: 0.6, ease: "power3.out" });
        const onMove = (e: PointerEvent) => {
          const ratio = e.clientX / window.innerWidth - 0.5;
          rotate(ratio * 18);
          shift(ratio * 24);
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
      });
    },
    { scope: root },
  );

  return (
    <section id="mo-dau" ref={root} className="relative flex min-h-[100svh] items-center overflow-hidden">
      <div className={`${WRAP} grid items-center gap-12 pb-20 pt-32 lg:grid-cols-[1.5fr_1fr]`}>
        <div>
          <h1 className="text-[clamp(2.6rem,7vw,6.2rem)] font-extrabold leading-[0.98] tracking-tight text-ink">
            <span data-line className="block">
              {copy.lines[0]}
            </span>
            <span data-line className="block text-primary">
              {copy.lines[1]}
            </span>
          </h1>
          <p data-fade className="mt-8 max-w-xl text-lg leading-relaxed text-ink/70">
            {copy.sub}
          </p>
          <div data-fade className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/dang-nhap"
              className="rounded-full bg-ink px-7 py-3.5 text-sm font-bold text-paper transition-transform duration-300 hover:-translate-y-0.5"
            >
              {copy.primary}
            </Link>
            <a
              href="#van-de"
              className="rounded-full border border-ink/15 px-7 py-3.5 text-sm font-bold text-ink transition-colors hover:border-ink/40"
            >
              {copy.secondary}
            </a>
          </div>
        </div>
        <div data-key-scroll className="relative mx-auto w-full max-w-md">
          <div data-key className="text-ink">
            <KeyArt className="w-full -rotate-12" />
          </div>
        </div>
      </div>
    </section>
  );
}
