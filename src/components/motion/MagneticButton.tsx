"use client";

import { useRef, useEffect, type ReactNode, type MouseEvent } from "react";
import { gsap } from "gsap";

export type MagneticButtonProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  href?: string;
  ariaLabel?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export function MagneticButton({
  children,
  className = "",
  strength = 0.3,
  onClick,
  href,
  ariaLabel,
  type = "button",
  disabled = false,
}: MagneticButtonProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const quickXRef = useRef<((val: number) => void) | null>(null);
  const quickYRef = useRef<((val: number) => void) | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Chỉ dùng quickTo với con trỏ chính xác
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      quickXRef.current = gsap.quickTo(el, "x", { duration: 0.25, ease: "power2.out" });
      quickYRef.current = gsap.quickTo(el, "y", { duration: 0.25, ease: "power2.out" });
    }

    return () => {
      quickXRef.current = null;
      quickYRef.current = null;
    };
  }, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    // Cache bounding client rect một lần khi rê chuột vào, không gọi mỗi frame mousemove
    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (
      disabled ||
      !quickXRef.current ||
      !quickYRef.current ||
      !rectRef.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const rect = rectRef.current;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;

    quickXRef.current(deltaX);
    quickYRef.current(deltaY);
  };

  const handleMouseLeave = () => {
    rectRef.current = null;
    const el = containerRef.current;
    if (!el) return;

    gsap.to(el, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: "elastic.out(1.1, 0.4)",
      overwrite: "auto",
    });
  };

  const commonProps = {
    ref: (node: HTMLButtonElement | HTMLAnchorElement | null) => {
      containerRef.current = node;
    },
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    className: `relative inline-flex items-center justify-center select-none ${className}`,
    "data-cursor-hover": "true",
    "data-magnetic": "true",
    "aria-label": ariaLabel,
  };

  if (href) {
    return (
      <a href={href} onClick={onClick} {...commonProps}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} {...commonProps}>
      {children}
    </button>
  );
}
