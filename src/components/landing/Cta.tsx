"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { gsap, HOVER, MOTION, revealTitle, WRAP } from "./motion";
import { KeyArt } from "./Hero";

const copy = marketingVi.landing.cta;

export function Cta() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        revealTitle(root.current?.querySelector("h2") ?? null);
        gsap.from("[data-role]", {
          y: 80,
          rotation: (i) => (i === 0 ? -4 : 4),
          opacity: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-roles]", start: "top 80%", once: true },
        });
      });

      // Hover: thẻ nghiêng theo con trỏ, chìa khóa trong thẻ xoay
      mm.add(`${MOTION} and ${HOVER}`, () => {
        const cleanups = gsap.utils.toArray<HTMLElement>("[data-role]").map((card) => {
          const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
          const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
          const key = card.querySelector("[data-role-key]");
          const move = (e: PointerEvent) => {
            const r = card.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 10);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
          };
          const enter = () => key && gsap.to(key, { rotation: -90, duration: 0.6, ease: "back.out(2)" });
          const leave = () => {
            rx(0);
            ry(0);
            if (key) gsap.to(key, { rotation: 0, duration: 0.5, ease: "power3.out" });
          };
          card.addEventListener("pointermove", move);
          card.addEventListener("pointerenter", enter);
          card.addEventListener("pointerleave", leave);
          return () => {
            card.removeEventListener("pointermove", move);
            card.removeEventListener("pointerenter", enter);
            card.removeEventListener("pointerleave", leave);
          };
        });
        return () => cleanups.forEach((fn) => fn());
      });
    },
    { scope: root },
  );

  return (
    <section id="dung-thu" ref={root} className="pb-32 pt-12">
      <div className={WRAP}>
        <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight text-ink">
          {copy.title}
        </h2>
        <div data-roles className="mt-14 grid gap-6 [perspective:1200px] md:grid-cols-2">
          {copy.roles.map((r, i) => (
            <Link
              key={r.role}
              href={r.link}
              data-role
              className={`group flex min-h-[300px] flex-col rounded-[2rem] p-10 will-change-transform ${
                i === 0 ? "bg-ink text-paper" : "bg-primary text-paper"
              }`}
            >
              <div data-role-key className="w-28 opacity-80">
                <KeyArt className="w-full" />
              </div>
              <h3 className="mt-auto pt-12 text-4xl font-extrabold tracking-tight">{r.role}</h3>
              <p className="mt-3 text-lg text-paper/75">{r.text}</p>
              <span className="mt-8 text-sm font-bold">
                {copy.action} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
