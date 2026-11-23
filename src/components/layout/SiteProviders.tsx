"use client";

import type { ReactNode } from "react";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { CustomCursor } from "@/components/motion/CustomCursor";
import { PageTransitionOverlay } from "@/components/motion/PageTransitionOverlay";

export type SiteProvidersProps = {
  children: ReactNode;
};

/**
 * SiteProviders cung cấp hạ tầng tương tác cho toàn bộ RentFlow:
 * 1. SmoothScrollProvider (Lenis + GSAP ScrollTrigger)
 * 2. CustomCursor (con trỏ tùy biến không giật)
 * 3. PageTransitionOverlay (chuyển trang mượt mà)
 */
export function SiteProviders({ children }: SiteProvidersProps) {
  return (
    <SmoothScrollProvider>
      <CustomCursor />
      <PageTransitionOverlay />
      {children}
    </SmoothScrollProvider>
  );
}
