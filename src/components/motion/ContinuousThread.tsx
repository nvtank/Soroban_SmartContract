"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function ContinuousThread() {
  const pathRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const container = containerRef.current;
    if (!path || !container) return;

    // Chỉ kích hoạt từ màn hình xl trở lên và không giảm chuyển động
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 1280px) and (prefers-reduced-motion: no-preference)",
      () => {
        // Đo chiều dài path duy nhất 1 lần khi khởi tạo, tuyệt đối không gọi getTotalLength() mỗi frame cuộn!
        const totalLen = Math.ceil(path.getTotalLength() || 1200);
        path.style.strokeDasharray = `${totalLen}`;
        path.style.strokeDashoffset = `${totalLen}`;

        gsap.to(path, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: document.body,
            start: "top top+=150",
            end: "max",
            scrub: true,
            refreshPriority: -1,
          },
        });
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="hidden xl:block pointer-events-none absolute right-[max(1.5rem,calc(50%-44rem))] top-[100vh] bottom-0 z-0 w-8 overflow-hidden opacity-50"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 1000"
        preserveAspectRatio="none"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          ref={pathRef}
          d="M 16 10 
             C 26 80, 6 160, 16 240 
             C 26 320, 6 400, 16 480 
             C 26 560, 6 640, 16 720 
             C 26 800, 6 880, 16 960 
             L 16 990"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
