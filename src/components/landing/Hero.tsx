"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { marketingVi } from "@/i18n/sections/marketing";
import { gsap, HOVER, MOTION, ScrollTrigger, SplitText, WRAP } from "./motion";

const copy = marketingVi.landing.hero;

/** Chiếc chìa khóa: hình ảnh xuyên suốt câu chuyện. Nằm ngang, cân giữa khung vẽ. */
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

/** Họa tiết quanh chìa khóa: vòng xoay, chấm chạy quỹ đạo, hình trôi nổi. */
function HeroArt() {
  return (
    <>
      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full text-ink"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="200" cy="200" r="192" stroke="currentColor" strokeOpacity="0.07" />
        <g data-ring-a>
          <circle
            cx="200"
            cy="200"
            r="168"
            stroke="currentColor"
            strokeOpacity="0.28"
            strokeDasharray="2 9"
            strokeLinecap="round"
          />
          <circle cx="200" cy="32" r="6" className="fill-primary" />
          <circle cx="368" cy="200" r="3.5" fill="currentColor" fillOpacity="0.5" />
        </g>
        <g data-ring-b>
          <circle
            cx="200"
            cy="200"
            r="132"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="2"
            strokeDasharray="46 16"
          />
          <rect
            x="62"
            y="194"
            width="12"
            height="12"
            rx="3"
            className="fill-amber"
            transform="rotate(45 68 200)"
          />
        </g>
      </svg>

      {/* Tấm khóa tròn ở giữa */}
      <div
        data-depth="0.3"
        className="absolute inset-[24%] rounded-full bg-surface shadow-[inset_0_2px_10px_rgba(20,30,60,0.08),0_30px_60px_-30px_rgba(20,30,60,0.35)]"
      />

      {/* Hình trôi nổi */}
      <span
        data-float
        data-depth="1"
        className="absolute left-[4%] top-[16%] h-4 w-4 rounded-full border-2 border-primary"
        aria-hidden="true"
      />
      <span
        data-float
        data-depth="1.4"
        className="absolute right-[8%] top-[10%] h-3 w-3 rounded-[4px] bg-ink/80"
        aria-hidden="true"
      />
      <span
        data-float
        data-depth="0.8"
        className="absolute bottom-[12%] left-[14%] h-2.5 w-2.5 rounded-full bg-amber"
        aria-hidden="true"
      />
      <span
        data-float
        data-depth="1.2"
        className="absolute bottom-[8%] right-[18%] h-5 w-5 rounded-full border-2 border-ink/25"
        aria-hidden="true"
      />

      {/* Ổ khóa nhỏ: két mà chìa sẽ mở */}
      <svg
        data-float
        data-depth="1.6"
        viewBox="0 0 40 48"
        className="absolute right-[2%] top-[56%] w-9 text-primary"
        fill="none"
        aria-hidden="true"
      >
        <path d="M11 20v-6a9 9 0 0 1 18 0v6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <rect x="4" y="20" width="32" height="24" rx="6" fill="currentColor" />
        <circle cx="20" cy="31" r="3.5" fill="white" />
      </svg>
    </>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const lines = gsap.utils.toArray<HTMLElement>("[data-line]");
        const splits = lines.map(
          (line) => new SplitText(line, { type: "words", wordsClass: "inline-block" }),
        );
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(
          splits.flatMap((s) => s.words),
          {
            yPercent: 80,
            opacity: 0,
            filter: "blur(10px)",
            duration: 1,
            stagger: 0.07,
            clearProps: "filter",
          },
        )
          .from("[data-art]", { scale: 0.85, opacity: 0, duration: 1.1 }, 0.1)
          .from("[data-key]", { xPercent: -30, opacity: 0, duration: 1 }, 0.35)
          .from(
            "[data-float]",
            { scale: 0, opacity: 0, duration: 0.6, stagger: 0.08, ease: "back.out(2.5)" },
            0.6,
          )
          .from("[data-fade]", { y: 24, opacity: 0, duration: 0.7, stagger: 0.1 }, 0.6);

        // Vòng xoay liên tục, chỉ chạy khi hero đang trên màn hình
        const spinA = gsap.to("[data-ring-a]", {
          rotation: 360,
          svgOrigin: "200 200",
          duration: 48,
          repeat: -1,
          ease: "none",
        });
        const spinB = gsap.to("[data-ring-b]", {
          rotation: -360,
          svgOrigin: "200 200",
          duration: 34,
          repeat: -1,
          ease: "none",
        });
        const bob = gsap.to("[data-float]", {
          y: -10,
          duration: 2.6,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          stagger: { each: 0.4, from: "random" },
        });
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => [spinA, spinB, bob].forEach((t) => (self.isActive ? t.resume() : t.pause())),
        });

        // Cuộn xuống: chìa khóa xoay như đang mở khóa và rơi dần sang chương sau
        gsap.to("[data-key-scroll]", {
          rotation: -90,
          yPercent: 45,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: 0.6 },
        });
      });

      // Hover trên hình: chìa nghiêng nhẹ, các họa tiết dịch theo chiều sâu. Rời chuột thì về thẳng.
      mm.add(`${MOTION} and ${HOVER}`, () => {
        const art = root.current?.querySelector<HTMLElement>("[data-art]");
        const key = root.current?.querySelector("[data-key]");
        if (!art || !key) return;
        const rotate = gsap.quickTo(key, "rotation", { duration: 0.6, ease: "power3.out" });
        const layers = gsap.utils.toArray<HTMLElement>("[data-depth]", art).map((el) => ({
          depth: Number(el.dataset.depth),
          x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" }),
          y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" }),
        }));
        const move = (e: PointerEvent) => {
          const r = art.getBoundingClientRect();
          const rx = (e.clientX - r.left) / r.width - 0.5;
          const ry = (e.clientY - r.top) / r.height - 0.5;
          rotate(rx * 12);
          layers.forEach((l) => {
            l.x(rx * 16 * l.depth);
            l.y(ry * 16 * l.depth);
          });
        };
        const leave = () => {
          rotate(0);
          layers.forEach((l) => {
            l.x(0);
            l.y(0);
          });
        };
        art.addEventListener("pointermove", move);
        art.addEventListener("pointerleave", leave);
        return () => {
          art.removeEventListener("pointermove", move);
          art.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: root },
  );

  return (
    <section id="mo-dau" ref={root} className="relative flex min-h-[100svh] items-center overflow-hidden">
      {/* Nền chấm mờ dần về phía hình */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(20,30,60,0.13)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_60%_at_72%_45%,black,transparent)]"
      />
      <div className={`${WRAP} relative grid items-center gap-12 pb-20 pt-32 lg:grid-cols-[1.4fr_1fr]`}>
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

        <div data-key-scroll className="relative mx-auto w-full max-w-[460px]">
          <div data-art className="relative aspect-square w-full">
            <HeroArt />
            <div className="absolute inset-0 flex items-center justify-center">
              <div data-key data-depth="0.5" className="w-[58%] text-ink">
                <KeyArt className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
