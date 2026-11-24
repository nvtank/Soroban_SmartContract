"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);
}

export function HeroKeyAnimation() {
  const containerRef = useRef<SVGSVGElement>(null);
  const housePathRef = useRef<SVGPathElement>(null);
  const keyRef = useRef<SVGGElement>(null);
  const keyStrokesRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const container = containerRef.current;
    const house = housePathRef.current;
    const key = keyRef.current;
    const keyStrokes = keyStrokesRef.current;
    const glow = glowRef.current;
    if (!container || !house || !key || !keyStrokes || !glow) return;

    let glowTween: gsap.core.Tween | null = null;
    let st: ScrollTrigger | null = null;

    // Timeline vẽ nét ngôi nhà và chìa khóa tra vào ổ
    const tl = gsap.timeline({ delay: 0.3 });

    // 1. Vẽ nét ngôi nhà bằng DrawSVG
    tl.fromTo(
      house,
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: 1.3, ease: "power2.inOut" }
    )
      // 2. Vẽ nét chiếc chìa khóa
      .fromTo(
        keyStrokes,
        { drawSVG: "0%", opacity: 0 },
        { drawSVG: "100%", opacity: 1, duration: 1.0, ease: "power2.out" },
        "-=0.5"
      )
      // 3. Chìa khóa di chuyển và tra vào ổ khóa
      .fromTo(
        key,
        { x: 30, y: -25, rotate: -35, transformOrigin: "center center" },
        { x: 0, y: 0, rotate: 0, duration: 0.8, ease: "back.out(1.4)" }
      )
      // 4. Chìa xoay một góc 45 độ tượng trưng cho việc vặn khóa bảo chứng
      .to(key, {
        rotate: 45,
        duration: 0.45,
        ease: "power2.inOut",
      })
      // 5. Khởi tạo glow animation lặp lại NHƯNG CHỈ CHẠY KHI TRONG KHUNG NHÌN
      .add(() => {
        glowTween = gsap.to(glow, {
          scale: 1.3,
          opacity: 0.5,
          duration: 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        // Tạm dừng nếu ra khỏi khung nhìn
        st = ScrollTrigger.create({
          trigger: container,
          start: "top bottom",
          end: "bottom top",
          onLeave: () => glowTween?.pause(),
          onEnter: () => glowTween?.play(),
          onLeaveBack: () => glowTween?.pause(),
          onEnterBack: () => glowTween?.play(),
        });
      });

    return () => {
      tl.kill();
      glowTween?.kill();
      st?.kill();
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center p-6">
      <svg
        ref={containerRef}
        viewBox="0 0 320 280"
        className="h-64 w-64 sm:h-72 sm:w-72 md:h-80 md:w-80 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Minh họa ngôi nhà và chìa khóa bảo chứng tiền cọc"
      >
        {/* Nền mềm mại */}
        <circle cx="160" cy="140" r="115" fill="var(--surface)" opacity="0.6" />

        {/* Nét vẽ ngôi nhà (House Outline) */}
        <path
          ref={housePathRef}
          d="M 60 140 L 160 50 L 260 140 L 240 140 L 240 230 C 240 236 235 240 229 240 L 91 240 C 85 240 80 236 80 230 L 80 140 Z"
          stroke="var(--ink)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cửa chính ngôi nhà */}
        <path
          d="M 125 240 L 125 155 C 125 145 135 140 160 140 C 185 140 195 145 195 155 L 195 240"
          stroke="var(--line)"
          strokeWidth="2.5"
          strokeDasharray="4 4"
        />

        {/* Vầng sáng khởi đầu sợi chỉ (Glow) */}
        <circle ref={glowRef} cx="160" cy="165" r="14" fill="var(--primary)" opacity="0" />

        {/* Ổ khóa trên cửa */}
        <circle cx="160" cy="165" r="6" fill="var(--ink)" />
        <rect x="158.5" y="165" width="3" height="8" rx="1.5" fill="var(--ink)" />

        {/* Chiếc chìa khóa (Key) */}
        <g ref={keyRef}>
          <path
            ref={keyStrokesRef}
            d="M 160 165 L 160 110 M 160 120 L 172 120 M 160 132 L 168 132 M 160 110 C 150 110 142 102 142 92 C 142 82 150 74 160 74 C 170 74 178 82 178 92 C 178 102 170 110 160 110 Z"
            stroke="var(--primary-strong)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="160" cy="92" r="4.5" fill="var(--paper)" stroke="var(--primary-strong)" strokeWidth="2.5" />
        </g>
      </svg>
    </div>
  );
}
