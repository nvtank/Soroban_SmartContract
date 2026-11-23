"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function CustomCursor() {
  const followerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Không chạy nếu là màn hình cảm ứng hoặc giảm chuyển động
    if (
      window.matchMedia("(hover: none) or (pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const follower = followerRef.current;
    const dot = dotRef.current;
    if (!follower || !dot) return;

    // Thiết lập vị trí ban đầu ra khỏi màn hình
    gsap.set([follower, dot], { xPercent: -50, yPercent: -50, opacity: 0 });

    let isVisible = false;

    const onMouseMove = (e: MouseEvent) => {
      if (!isVisible) {
        gsap.to([follower, dot], { opacity: 1, duration: 0.2 });
        isVisible = true;
      }

      // Dot đi theo chuột lập tức
      gsap.to(dot, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.08,
        ease: "power1.out",
      });

      // Follower bám theo mượt mà
      gsap.to(follower, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.35,
        ease: "power2.out",
      });
    };

    const onMouseLeave = () => {
      gsap.to([follower, dot], { opacity: 0, duration: 0.2 });
      isVisible = false;
    };

    const handleInteractiveEnter = () => {
      follower.classList.add("custom-cursor-hover");
      gsap.to(dot, { scale: 0, duration: 0.15 });
    };

    const handleInteractiveLeave = () => {
      follower.classList.remove("custom-cursor-hover");
      gsap.to(dot, { scale: 1, duration: 0.15 });
    };

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    // Gắn sự kiện phóng to khi trỏ vào nút, link, hoặc phần tử tương tác
    const attachHoverListeners = () => {
      const targets = document.querySelectorAll<HTMLElement>(
        "a, button, [role='button'], input, select, textarea, [data-cursor-hover]"
      );
      targets.forEach((target) => {
        target.addEventListener("mouseenter", handleInteractiveEnter);
        target.addEventListener("mouseleave", handleInteractiveLeave);
      });
    };

    attachHoverListeners();

    // Lắng nghe thêm DOM thay đổi để bắt các nút sinh động
    const observer = new MutationObserver(attachHoverListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={followerRef} className="custom-cursor-follower" aria-hidden="true" />
      <div ref={dotRef} className="custom-cursor-dot" aria-hidden="true" />
    </>
  );
}
