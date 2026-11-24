"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

// Đăng ký ScrollTrigger ở client
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Module-level reference and store for the active Lenis instance
let activeLenis: Lenis | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

const lenisStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return activeLenis;
  },
  getServerSnapshot() {
    return null;
  },
  set(instance: Lenis | null) {
    activeLenis = instance;
    emitChange();
  },
};

export function getLenis(): Lenis | null {
  return activeLenis;
}

export function stopLenis(): void {
  activeLenis?.stop();
}

export function startLenis(): void {
  activeLenis?.start();
}

export function scrollTo(
  target: string | number | HTMLElement,
  options?: Parameters<Lenis["scrollTo"]>[1]
): void {
  activeLenis?.scrollTo(target, options);
}

type SmoothScrollContextValue = {
  lenis: Lenis | null;
  stop: () => void;
  start: () => void;
  scrollTo: (
    target: string | number | HTMLElement,
    options?: Parameters<Lenis["scrollTo"]>[1]
  ) => void;
};

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
  stop: stopLenis,
  start: startLenis,
  scrollTo: scrollTo,
});

export function useSmoothScroll(): SmoothScrollContextValue {
  return useContext(SmoothScrollContext);
}

export type SmoothScrollProviderProps = {
  children: ReactNode;
};

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const currentLenis = useSyncExternalStore(
    lenisStore.subscribe,
    lenisStore.getSnapshot,
    lenisStore.getServerSnapshot
  );

  useEffect(() => {
    // Tôn trọng prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      lenisStore.set(null);
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      anchors: { offset: -90 },
      allowNestedScroll: true,
      smoothWheel: true,
      orientation: "vertical",
      gestureOrientation: "vertical",
      wheelMultiplier: 0.9,
    });

    lenisStore.set(lenis);

    // Đồng bộ Lenis với ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    // Refresh ScrollTrigger sau khi fonts tải xong
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      });
    }

    // Refresh dự phòng khi DOM ổn định
    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 250);

    return () => {
      clearTimeout(refreshTimer);
      gsap.ticker.remove(tickerCallback);
      // Khôi phục lagSmoothing mặc định của GSAP
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisStore.set(null);
    };
  }, []);

  const contextValue: SmoothScrollContextValue = {
    lenis: currentLenis,
    stop: stopLenis,
    start: startLenis,
    scrollTo: scrollTo,
  };

  return (
    <SmoothScrollContext.Provider value={contextValue}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
