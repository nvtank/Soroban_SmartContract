"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);
}

export function ContinuousThread() {
  const pathRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const path = pathRef.current;
    if (!path) return;

    // Scrub tiến trình vẽ sợi chỉ từ đầu trang đến cuối trang
    const ctx = gsap.context(() => {
      gsap.fromTo(
        path,
        { drawSVG: "0%" },
        {
          drawSVG: "100%",
          ease: "none",
          scrollTrigger: {
            trigger: document.body,
            start: "top top+=200",
            end: "bottom bottom-=300",
            scrub: 0.5,
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[100vh] bottom-0 z-0 overflow-hidden opacity-40 md:opacity-60"
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          ref={pathRef}
          d="M 50 15 
             C 75 80, 25 150, 50 220 
             C 80 300, 20 380, 50 460 
             C 75 540, 25 620, 50 700 
             C 80 780, 30 860, 50 940 
             L 50 990"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="6 8"
          vectorEffect="non-scaling-stroke"
          className="thread-glow"
        />
      </svg>
    </div>
  );
}
