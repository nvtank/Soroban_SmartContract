"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
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

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (disabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;

    gsap.to(el, {
      x: deltaX,
      y: deltaY,
      duration: 0.25,
      ease: "power2.out",
    });
  };

  const handleMouseLeave = () => {
    const el = containerRef.current;
    if (!el) return;

    gsap.to(el, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "elastic.out(1.1, 0.4)",
    });
  };

  const commonProps = {
    ref: (node: HTMLButtonElement | HTMLAnchorElement | null) => {
      containerRef.current = node;
    },
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
