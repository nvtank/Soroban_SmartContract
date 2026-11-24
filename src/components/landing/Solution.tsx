"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { DESKTOP_MOTION, gsap, MOTION, revealTitle, WRAP } from "./motion";

const copy = marketingVi.landing.solution;

// Tọa độ hai ổ khóa trong khung vẽ 600 x 380
const HOLE_L = { x: 238, y: 200 };
const HOLE_R = { x: 362, y: 200 };

/** Chìa khóa nằm ngang, đầu chìa ở gốc tọa độ (0, 0) để dễ đặt vào ổ khóa. */
function Key({ flip }: { flip?: boolean }) {
  return (
    <g transform={flip ? "scale(-1,1)" : undefined}>
      <circle cx="-150" cy="0" r="26" stroke="currentColor" strokeWidth="8" fill="none" />
      <circle cx="-150" cy="0" r="8" className="fill-primary" />
      <path d="M-124 0H0M-34 0v16M-14 0v11" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

export function Solution() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      const build = () => {
        const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        tl.from("[data-key-l]", { x: "-=200", opacity: 0, duration: 1 }, 0)
          .from("[data-key-r]", { x: "+=200", opacity: 0, duration: 1 }, 0)
          .to("[data-key-l]", { rotation: 90, svgOrigin: `${HOLE_L.x} ${HOLE_L.y}`, duration: 0.8 }, 1.1)
          .to("[data-key-r]", { rotation: -90, svgOrigin: `${HOLE_R.x} ${HOLE_R.y}`, duration: 0.8 }, 1.1)
          .to("[data-dial]", { rotation: 360, svgOrigin: "300 96", duration: 1 }, 1.6)
          .to("[data-key-l], [data-key-r]", { opacity: 0, duration: 0.4 }, 2.3)
          // Hai cánh cửa gập về hai mép két (không trượt ra ngoài khung)
          .to("[data-door-l]", { scaleX: 0.12, svgOrigin: "168 231", duration: 1 }, 2.4)
          .to("[data-door-r]", { scaleX: 0.12, svgOrigin: "432 231", duration: 1 }, 2.4)
          .from("[data-open]", { scale: 0.6, opacity: 0, transformOrigin: "50% 50%", duration: 0.6 }, 2.8);
        return tl;
      };

      mm.add(MOTION, () => revealTitle(root.current?.querySelector("h2") ?? null));

      // Máy tính: ghim chương, hai chìa xoay theo tiến độ cuộn
      mm.add(DESKTOP_MOTION, () => {
        const tl = build();
        tl.pause();
        gsap.to(tl, {
          progress: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${window.innerHeight * 1.4}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
      });

      // Điện thoại: chạy một lần khi cuộn tới
      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 1023px)", () => {
        const tl = build();
        tl.pause();
        gsap.to(tl, {
          progress: 1,
          duration: 2.4,
          ease: "none",
          scrollTrigger: { trigger: "[data-safe]", start: "top 70%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="giai-phap" ref={root} className="relative py-20 lg:flex lg:min-h-[100svh] lg:items-center lg:py-24">
      <div className={`${WRAP} grid items-center gap-14 lg:grid-cols-[1fr_1.25fr]`}>
        <div>
          <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight text-ink">
            {copy.title}
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/65">{copy.text}</p>
        </div>

        <svg data-safe viewBox="0 0 600 380" className="w-full text-ink" fill="none" role="img" aria-label={copy.title}>
          {/* Thân két */}
          <rect x="150" y="40" width="300" height="300" rx="28" className="fill-surface" stroke="currentColor" strokeWidth="6" />
          {/* Lớp bên trong lộ ra khi két mở */}
          <g data-open>
            <circle cx="300" cy="215" r="44" className="fill-primary" />
            <path d="M282 215l12 12 24-26" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {/* Hai cánh cửa, mỗi cánh mang một ổ khóa */}
          <g data-door-l>
            <rect x="168" y="140" width="132" height="182" rx="14" className="fill-paper" stroke="currentColor" strokeWidth="4" />
            <circle cx={HOLE_L.x} cy={HOLE_L.y} r="9" fill="currentColor" />
          </g>
          <g data-door-r>
            <rect x="300" y="140" width="132" height="182" rx="14" className="fill-paper" stroke="currentColor" strokeWidth="4" />
            <circle cx={HOLE_R.x} cy={HOLE_R.y} r="9" fill="currentColor" />
          </g>
          {/* Núm xoay */}
          <g data-dial>
            <circle cx="300" cy="96" r="30" stroke="currentColor" strokeWidth="6" className="fill-paper" />
            <path d="M300 72v14" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          </g>
          {/* Hai chìa: đầu chìa nằm đúng ổ khóa */}
          <g data-key-l transform={`translate(${HOLE_L.x} ${HOLE_L.y})`} className="text-ink">
            <Key />
          </g>
          <g data-key-r transform={`translate(${HOLE_R.x} ${HOLE_R.y})`} className="text-primary">
            <Key flip />
          </g>
          <text x="88" y="250" textAnchor="middle" className="fill-ink/60 text-[15px] font-semibold">
            {copy.keys[0]}
          </text>
          <text x="512" y="250" textAnchor="middle" className="fill-ink/60 text-[15px] font-semibold">
            {copy.keys[1]}
          </text>
        </svg>
      </div>
    </section>
  );
}
