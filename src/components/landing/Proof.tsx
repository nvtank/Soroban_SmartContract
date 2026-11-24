"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { gsap, MOTION, revealTitle, WRAP } from "./motion";

const copy = marketingVi.landing.proof;

// Vòng chữ: bán kính 230 trong khung 560 x 560
const R = 230;
const CIRCUMFERENCE = Math.round(2 * Math.PI * R);
const RING_PATH = `M 280 ${280 - R} a ${R} ${R} 0 1 1 0 ${2 * R} a ${R} ${R} 0 1 1 0 -${2 * R}`;

export function Proof() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        revealTitle(root.current?.querySelector("h2") ?? null);

        // Khối tối nở ra khi vào chương
        gsap.from("[data-panel]", {
          scale: 0.94,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "top 30%", scrub: true },
        });

        // Vòng tên các thao tác on-chain xoay theo cuộn, vòng trong xoay ngược
        const spin = { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.8 };
        gsap.to("[data-ring]", { rotation: 220, svgOrigin: "280 280", ease: "none", scrollTrigger: spin });
        gsap.to("[data-ring-inner]", { rotation: -160, svgOrigin: "280 280", ease: "none", scrollTrigger: spin });

        // Con dấu đóng xuống khi vòng tới giữa màn hình
        gsap.from("[data-stamp]", {
          scale: 1.8,
          rotation: -30,
          opacity: 0,
          transformOrigin: "50% 50%",
          ease: "back.out(2.2)",
          duration: 0.7,
          scrollTrigger: { trigger: "[data-ring-box]", start: "top 55%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="on-chain" ref={root} className="relative px-3 py-6 sm:px-6">
      <div data-panel className="overflow-hidden rounded-[2.5rem] bg-ink py-16 lg:py-24 text-paper will-change-transform">
        <div className={`${WRAP} grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]`}>
          <div>
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/70">{copy.text}</p>
            <Link
              href="/bang-chung"
              className="mt-10 inline-block rounded-full border border-paper/25 px-6 py-3 text-sm font-bold transition-colors hover:border-paper/60"
            >
              {copy.link}
            </Link>
          </div>

          <div data-ring-box className="mx-auto w-full max-w-[520px]">
            <svg viewBox="0 0 560 560" className="w-full" fill="none" aria-hidden="true">
              <defs>
                <path id="proof-ring" d={RING_PATH} />
              </defs>
              <g data-ring>
                <text className="fill-paper/80 font-mono text-[13px]">
                  <textPath href="#proof-ring" textLength={CIRCUMFERENCE - 20} lengthAdjust="spacing">
                    {copy.functions.join("  ·  ")}
                  </textPath>
                </text>
              </g>
              <g data-ring-inner>
                <circle cx="280" cy="280" r="178" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 10" />
                <circle cx="280" cy="98" r="6" className="fill-primary" />
              </g>
              <g data-stamp>
                <circle cx="280" cy="280" r="118" className="fill-primary" />
                <circle cx="280" cy="280" r="104" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
                <text x="280" y="272" textAnchor="middle" className="fill-paper text-[20px] font-extrabold">
                  {copy.stamp.split(" trên ")[0]}
                </text>
                <text x="280" y="300" textAnchor="middle" className="fill-paper/80 text-[14px] font-semibold">
                  trên {copy.stamp.split(" trên ")[1]}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
