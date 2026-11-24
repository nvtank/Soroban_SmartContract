"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { gsap, MOTION, revealTitle, WRAP } from "./motion";

const copy = marketingVi.landing.truth;

function Column({ label, items, tone, side }: { label: string; items: readonly string[]; tone: "real" | "sim"; side: "l" | "r" }) {
  return (
    <div data-col={side}>
      <p className={`text-sm font-bold uppercase tracking-[0.18em] ${tone === "real" ? "text-primary" : "text-amber-ink"}`}>
        {label}
      </p>
      <ul className="mt-6 border-t border-line">
        {items.map((item) => (
          <li
            key={item}
            className="border-b border-line py-5 text-lg font-semibold text-ink transition-transform duration-300 hover:translate-x-2 sm:text-xl"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Truth() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        revealTitle(root.current?.querySelector("h2") ?? null);
        (["l", "r"] as const).forEach((side) => {
          gsap.from(`[data-col="${side}"] li`, {
            x: side === "l" ? -40 : 40,
            opacity: 0,
            stagger: 0.08,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: `[data-col="${side}"]`, start: "top 80%", once: true },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="su-that" ref={root} className="py-20 lg:py-28">
      <div className={WRAP}>
        <h2 className="max-w-3xl text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight text-ink">
          {copy.title}
        </h2>
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
          <Column label={copy.realLabel} items={copy.real} tone="real" side="l" />
          <Column label={copy.simulatedLabel} items={copy.simulated} tone="sim" side="r" />
        </div>
        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-base text-ink/60">{copy.note}</p>
          <Link href="/minh-bach" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
            {copy.link} →
          </Link>
        </div>
      </div>
    </section>
  );
}
