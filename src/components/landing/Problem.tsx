"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { DESKTOP_MOTION, gsap, MOTION, revealTitle, WRAP } from "./motion";

const copy = marketingVi.landing.problem;

export function Problem() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]");
      const deck = root.current?.querySelector<HTMLElement>("[data-deck]");
      if (!deck || cards.length === 0) return;

      mm.add(MOTION, () => revealTitle(root.current?.querySelector("h2") ?? null));

      // Máy tính: ghim chương, các thẻ trượt lên chồng lên nhau
      mm.add(DESKTOP_MOTION, () => {
        gsap.set(deck, { height: Math.max(...cards.map((c) => c.offsetHeight)) });
        gsap.set(cards, { position: "absolute", inset: 0 });
        gsap.set(cards.slice(1), { yPercent: 115 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${window.innerHeight * (cards.length - 1) * 0.8}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        cards.slice(1).forEach((card, i) => {
          tl.to(card, { yPercent: 0, duration: 1 }, i).to(
            cards[i],
            { scale: 0.92, yPercent: -6, opacity: 0.45, duration: 1 },
            i,
          );
        });
      });

      // Điện thoại: thẻ trượt vào lần lượt từ hai phía
      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 1023px)", () => {
        cards.forEach((card, i) => {
          gsap.from(card, {
            x: i % 2 === 0 ? -60 : 60,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 85%", once: true },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="van-de" ref={root} className="relative py-20 lg:flex lg:min-h-[100svh] lg:items-center lg:py-24">
      <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]`}>
        <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight text-ink">
          {copy.title}
        </h2>
        <div data-deck className="relative flex flex-col gap-4">
          {copy.cards.map((card, i) => (
            <article
              key={card.title}
              data-card
              className="rounded-[2rem] border border-line bg-surface p-8 shadow-[0_30px_60px_-30px_rgba(20,30,60,0.25)] will-change-transform sm:p-10"
            >
              <span className="font-mono text-sm text-brick">0{i + 1}</span>
              <h3 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{card.title}</h3>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/65">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
