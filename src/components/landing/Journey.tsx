"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { DESKTOP_MOTION, gsap, MOTION, revealTitle, WRAP } from "./motion";

const copy = marketingVi.landing.journey;

export function Journey() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => revealTitle(root.current?.querySelector("h2") ?? null));

      // Máy tính: ghim chương, năm bước chạy ngang theo cuộn
      mm.add(DESKTOP_MOTION, () => {
        const track = root.current?.querySelector<HTMLElement>("[data-track]");
        if (!track) return;
        const distance = () => track.scrollWidth - window.innerWidth;

        const slide = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        gsap.fromTo("[data-progress]", { scaleX: 0 }, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });

        // Mỗi bước: số lớn xoay vào và chữ trượt lên khi bước đó chạy vào giữa màn hình
        gsap.utils.toArray<HTMLElement>("[data-step]").forEach((step) => {
          gsap.from(step.querySelectorAll("[data-step-in]"), {
            y: 50,
            opacity: 0,
            rotation: (i) => (i === 0 ? -25 : 0),
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: step,
              containerAnimation: slide,
              start: "left 75%",
              end: "left 40%",
              scrub: true,
            },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="hanh-trinh" ref={root} className="relative overflow-hidden py-20 lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center lg:py-24">
      <div className={WRAP}>
        <h2 className="max-w-3xl text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight text-ink">
          {copy.title}
        </h2>
        <div className="mt-8 hidden h-px w-full bg-line lg:block">
          <div data-progress className="h-px origin-left bg-primary" />
        </div>
      </div>

      {/* Điện thoại: vuốt ngang tự nhiên. Máy tính: dải ngang chạy theo cuộn. */}
      <div className="mt-12 overflow-x-auto overscroll-x-contain [scrollbar-width:none] lg:overflow-visible">
        <ol
          data-track
          className="flex w-max snap-x snap-mandatory gap-5 px-6 will-change-transform lg:gap-8 lg:px-[max(2.5rem,calc((100vw-72rem)/2+2.5rem))]"
        >
          {copy.steps.map((step, i) => (
            <li
              key={step.title}
              data-step
              className="flex w-[78vw] max-w-[440px] shrink-0 snap-start flex-col rounded-[2rem] border border-line bg-surface p-8 lg:w-[30vw] lg:max-w-[460px] lg:p-10"
            >
              <span data-step-in className="block text-7xl font-extrabold leading-none text-primary/25 lg:text-8xl">
                {i + 1}
              </span>
              <h3 data-step-in className="mt-10 text-2xl font-extrabold tracking-tight text-ink lg:text-3xl">
                {step.title}
              </h3>
              <p data-step-in className="mt-3 text-base leading-relaxed text-ink/65">
                {step.text}
              </p>
              <code data-step-in className="mt-auto pt-10 font-mono text-xs text-primary">
                {step.fn}
              </code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
