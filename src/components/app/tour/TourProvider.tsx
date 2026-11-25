"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/app/session-context";
import { TourOverlay } from "./TourOverlay";
import { TourPopup } from "./TourPopup";
import { needsScrollIntoView, rectsSignificantlyDifferent } from "./positioning";
import {
  advanceStepIndex,
  canUseNextButton,
  clearTourProgress,
  loadTourProgress,
  mapUserRoleToTourRole,
  markTourFinished,
  previousStepIndex,
  saveTourProgress,
  shouldAutoStartTour,
  TOUR_START_EVENT,
} from "./state";
import { getTourSteps } from "./tours";
import type { TourRect, TourRole, TourStatus, TourStep, ViewportSize } from "./types";

const TARGET_WAIT_TIMEOUT_MS = 8000;

function readElementRect(el: Element): TourRect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
  };
}

function isVisibleElement(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function findVisibleTarget(step: TourStep, isMock: boolean, currentPathname: string): HTMLElement | null {
  if (step.route && !step.route.test(currentPathname)) {
    return null;
  }

  const primary = document.querySelector(step.target);
  if (primary && isVisibleElement(primary)) {
    return primary;
  }

  if (isMock && step.fallbackTargets) {
    for (const sel of step.fallbackTargets) {
      const candidate = document.querySelector(sel);
      if (candidate && isVisibleElement(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const result: HTMLElement[] = [];
  if (root.matches(selector) && isVisibleElement(root)) {
    result.push(root);
  }
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (isVisibleElement(el) && !result.includes(el)) {
      result.push(el);
    }
  });
  return result;
}

function safeLocalStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function safeSessionStorage() {
  return typeof window !== "undefined" ? window.sessionStorage : null;
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoading, isMock } = useSession();

  const tourRole = useMemo(() => mapUserRoleToTourRole(user?.role ?? role), [user?.role, role]);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [active, setActive] = useState(false);
  const [activeRole, setActiveRole] = useState<TourRole | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<TourStatus>("idle");
  const [previousStatusBeforeExit, setPreviousStatusBeforeExit] = useState<TourStatus>("ready");
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 1366, height: 820 });
  const [hasExternalNavTour, setHasExternalNavTour] = useState(false);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  const lastRectRef = useRef<TourRect | null>(null);
  const stepAdvanceGuardRef = useRef<string | null>(null);
  const suppressTargetClickRef = useRef(false);

  const steps = useMemo(() => (activeRole ? getTourSteps(activeRole) : []), [activeRole]);
  const currentStep: TourStep | null = active && steps[stepIndex] ? steps[stepIndex] : null;

  // Kiểm tra nút [data-tour="nav-tour"] ngoài nút dự phòng (chỉ chạy 1 lần sau paint, không observer)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      const external = document.querySelector('[data-tour="nav-tour"]:not([data-tour-fallback="1"])');
      setHasExternalNavTour(Boolean(external));
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [pathname, user?.id]);

  const finishTour = useCallback(
    (reason: "completed" | "skipped") => {
      const roleToMark = activeRole ?? tourRole;
      if (roleToMark) {
        markTourFinished(safeLocalStorage(), safeSessionStorage(), roleToMark, reason);
      } else {
        clearTourProgress(safeSessionStorage());
      }
      targetElRef.current = null;
      lastRectRef.current = null;
      setTargetRect(null);
      setActive(false);
      setStatus("idle");
    },
    [activeRole, tourRole],
  );

  const startTour = useCallback(
    (explicitRole?: TourRole) => {
      const resolved = explicitRole ?? tourRole ?? "tenant";
      saveTourProgress(safeSessionStorage(), resolved, 0);
      stepAdvanceGuardRef.current = null;
      targetElRef.current = null;
      lastRectRef.current = null;
      setTargetRect(null);
      setActiveRole(resolved);
      setStepIndex(0);
      setActive(true);
      setStatus("waiting");

      const firstStep = getTourSteps(resolved)[0];
      if (firstStep?.route && !firstStep.route.test(pathname || "")) {
        router.push("/app");
      }
    },
    [tourRole, pathname, router],
  );

  // Tự khôi phục tiến độ từ sessionStorage hoặc tự khởi chạy lần đầu vào /app
  useEffect(() => {
    if (isLoading || !user || !tourRole) return;
    const timer = window.setTimeout(() => {
      if (active) {
        // Nếu người dùng đổi vai trong khi tour đang mở -> đóng tour cũ
        if (activeRole && activeRole !== tourRole) {
          clearTourProgress(safeSessionStorage());
          setActive(false);
          setStatus("idle");
        }
        return;
      }

      const saved = loadTourProgress(safeSessionStorage());
      if (saved) {
        if (saved.role === tourRole) {
          const total = getTourSteps(saved.role).length;
          const clamped = Math.min(saved.stepIndex, Math.max(0, total - 1));
          setActiveRole(saved.role);
          setStepIndex(clamped);
          setActive(true);
          setStatus("waiting");
          return;
        }
        clearTourProgress(safeSessionStorage());
      }

      const isDashboard = pathname === "/app" || pathname === "/app/";
      if (isDashboard && shouldAutoStartTour(tourRole, safeLocalStorage(), safeSessionStorage())) {
        saveTourProgress(safeSessionStorage(), tourRole, 0);
        setActiveRole(tourRole);
        setStepIndex(0);
        setActive(true);
        setStatus("waiting");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isLoading, user, tourRole, pathname, active, activeRole]);

  // Lắng nghe sự kiện "rentflow:tour-start" (nút Hướng dẫn của G hoặc nút dự phòng)
  useEffect(() => {
    const onStartEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ role?: TourRole }>).detail;
      startTour(detail?.role);
    };
    window.addEventListener(TOUR_START_EVENT, onStartEvent);
    return () => window.removeEventListener(TOUR_START_EVENT, onStartEvent);
  }, [startTour]);

  const goToStep = useCallback(
    (nextIdx: number) => {
      if (!activeRole) return;
      const tourSteps = getTourSteps(activeRole);
      if (nextIdx >= tourSteps.length) {
        finishTour("completed");
        return;
      }
      const clamped = Math.max(0, nextIdx);
      saveTourProgress(safeSessionStorage(), activeRole, clamped);
      stepAdvanceGuardRef.current = null;
      targetElRef.current = null;
      lastRectRef.current = null;
      setTargetRect(null);
      setStepIndex(clamped);
      setStatus("waiting");

      const nextStepDef = tourSteps[clamped];
      if (nextStepDef?.route && !nextStepDef.route.test(pathname || "") && nextStepDef.route.test("/app")) {
        router.push("/app");
      }
    },
    [activeRole, finishTour, pathname, router],
  );

  const handleAdvance = useCallback(() => {
    if (!activeRole) return;
    const { stepIndex: nextIdx, finished } = advanceStepIndex(stepIndex, steps.length);
    if (finished) {
      finishTour("completed");
    } else {
      goToStep(nextIdx);
    }
  }, [activeRole, stepIndex, steps.length, finishTour, goToStep]);

  const handlePrev = useCallback(() => {
    const prevIdx = previousStepIndex(stepIndex);
    if (prevIdx !== stepIndex) {
      goToStep(prevIdx);
    }
  }, [stepIndex, goToStep]);

  const handleNextButton = useCallback(() => {
    if (!currentStep || !canUseNextButton(currentStep)) return;

    if (currentStep.mode === "click" && currentStep.safeAutoClick) {
      const el = targetElRef.current;
      suppressTargetClickRef.current = true;
      try {
        el?.click();
      } finally {
        suppressTargetClickRef.current = false;
      }
    }
    handleAdvance();
  }, [currentStep, handleAdvance]);

  const isConfirmExit = status === "confirm-exit";

  // Chờ phần tử đích xuất hiện bằng MutationObserver (tối đa 8 giây) và gắn theo dõi vị trí + click
  useEffect(() => {
    if (!active || !currentStep || isConfirmExit) return;

    let cancelled = false;
    let rafId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attachedTarget: HTMLElement | null = null;
    let scrollResizeAttached = false;

    const updateMeasurement = () => {
      if (cancelled) return;
      const el = targetElRef.current;
      if (!el || !el.isConnected) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewport((prev) => (prev.width !== vw || prev.height !== vh ? { width: vw, height: vh } : prev));

      const nextRect = readElementRect(el);
      if (rectsSignificantlyDifferent(lastRectRef.current, nextRect)) {
        lastRectRef.current = nextRect;
        setTargetRect(nextRect);
      }
    };

    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateMeasurement();
      });
    };

    const onTargetClickCapture = () => {
      if (suppressTargetClickRef.current) return;
      if (stepAdvanceGuardRef.current === currentStep.id) return;
      stepAdvanceGuardRef.current = currentStep.id;
      // Không chặn hành vi gốc của nút; chuyển bước ở microtask kế tiếp
      window.setTimeout(() => {
        if (!cancelled) {
          handleAdvance();
        }
      }, 0);
    };

    const bindTarget = (el: HTMLElement) => {
      if (cancelled) return;
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      attachedTarget = el;
      targetElRef.current = el;

      const vp: ViewportSize = { width: window.innerWidth, height: window.innerHeight };
      setViewport(vp);

      const initialRect = readElementRect(el);
      if (needsScrollIntoView(initialRect, vp)) {
        el.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        });
      }

      const freshRect = readElementRect(el);
      lastRectRef.current = freshRect;
      setTargetRect(freshRect);
      setStatus("ready");

      // Gắn lắng nghe click ở pha capture cho bước mode === "click"
      if (currentStep.mode === "click") {
        el.addEventListener("click", onTargetClickCapture, { capture: true });
      }

      // Gắn lắng nghe cuộn / đổi kích thước (chỉ khi tour đang bật, gộp bằng rAF)
      window.addEventListener("scroll", scheduleMeasure, { capture: true, passive: true });
      window.addEventListener("resize", scheduleMeasure, { passive: true });
      scrollResizeAttached = true;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleMeasure);
        resizeObserver.observe(el);
      }

      // Đo lại một lần sau khi smooth scroll ổn định
      window.setTimeout(scheduleMeasure, 320);
    };

    const tryFind = (): boolean => {
      const found = findVisibleTarget(currentStep, isMock, window.location.pathname);
      if (found) {
        bindTarget(found);
        return true;
      }
      return false;
    };

    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (!tryFind()) {
        setStatus("waiting");
        mutationObserver = new MutationObserver(() => {
          if (tryFind()) {
            mutationObserver?.disconnect();
            mutationObserver = null;
          }
        });
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-tour", "data-tour-key", "class", "style", "hidden"],
        });

        timeoutId = setTimeout(() => {
          if (!cancelled && !targetElRef.current) {
            mutationObserver?.disconnect();
            mutationObserver = null;
            setStatus("missing");
          }
        }, TARGET_WAIT_TIMEOUT_MS);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      if (mutationObserver) mutationObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      if (attachedTarget && currentStep.mode === "click") {
        attachedTarget.removeEventListener("click", onTargetClickCapture, { capture: true });
      }
      if (scrollResizeAttached) {
        window.removeEventListener("scroll", scheduleMeasure, { capture: true });
        window.removeEventListener("resize", scheduleMeasure);
      }
    };
  }, [active, currentStep, pathname, isMock, reducedMotion, isConfirmExit, handleAdvance]);

  // Xử lý bàn phím: Esc hỏi xác nhận kết thúc; Tab chỉ đi vòng giữa phần tử đích và popup
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Khi đang hướng dẫn, Esc thuộc về hướng dẫn: không để hộp ký/thanh toán đang mở tự đóng theo,
        // nếu không bấm "Tiếp tục xem" sẽ mất phần tử đích và hướng dẫn bị kẹt.
        e.stopImmediatePropagation();
        if (status === "confirm-exit") {
          setStatus(previousStatusBeforeExit);
        } else {
          setPreviousStatusBeforeExit(status);
          setStatus("confirm-exit");
        }
        return;
      }

      if (e.key === "Tab") {
        const dialogRoot = status === "confirm-exit" ? confirmDialogRef.current : popupRef.current;
        const popupFocusables = getFocusableElements(dialogRoot);
        const targetFocusables =
          status === "ready" ? getFocusableElements(targetElRef.current) : [];
        const cycle = [...targetFocusables, ...popupFocusables];
        if (cycle.length === 0) return;

        const currentEl = document.activeElement as HTMLElement | null;
        const idx = currentEl ? cycle.indexOf(currentEl) : -1;

        e.preventDefault();
        if (e.shiftKey) {
          const prev = idx <= 0 ? cycle[cycle.length - 1] : cycle[idx - 1];
          prev.focus();
        } else {
          const next = idx === -1 || idx >= cycle.length - 1 ? cycle[0] : cycle[idx + 1];
          next.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, status, previousStatusBeforeExit]);

  // Focus vào hộp xác nhận thoát khi mở bằng Esc
  useEffect(() => {
    if (status === "confirm-exit") {
      confirmDialogRef.current?.focus({ preventScroll: true });
    }
  }, [status]);

  return (
    <>
      {children}

      {/* Nút "Hướng dẫn" dự phòng cố định góc dưới phải khi navbar của G chưa có [data-tour="nav-tour"] */}
      {!hasExternalNavTour && user && (
        <button
          type="button"
          data-tour="nav-tour"
          data-tour-fallback="1"
          onClick={() => window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))}
          className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-xs font-bold text-primary-strong shadow-soft hover:border-primary hover:bg-surface transition-colors cursor-pointer"
          aria-label="Mở hướng dẫn từng bước"
        >
          <span aria-hidden="true">?</span>
          <span>Hướng dẫn</span>
        </button>
      )}

      {/* Lớp phủ và Popup hướng dẫn — chỉ mount khi tour đang bật */}
      {active && currentStep && (
        <>
          <TourOverlay
            targetRect={status === "ready" ? targetRect : null}
            viewport={viewport}
            fullBlock={status !== "ready"}
            reducedMotion={reducedMotion}
          />

          {status === "ready" && (
            <TourPopup
              step={currentStep}
              stepIndex={stepIndex}
              totalSteps={steps.length}
              targetRect={targetRect}
              viewport={viewport}
              reducedMotion={reducedMotion}
              popupRef={popupRef}
              onNext={handleNextButton}
              onPrev={handlePrev}
              onSkip={() => finishTour("skipped")}
            />
          )}

          {status === "missing" && (
            <div
              ref={popupRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-missing-title"
              aria-describedby="tour-missing-body"
              tabIndex={-1}
              data-tour-popup="missing"
              className="fixed top-1/2 left-1/2 z-[9995] w-[340px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-paper p-5 shadow-soft outline-none"
            >
              <span aria-live="polite" className="font-mono text-xs font-bold text-ink/50">
                {stepIndex + 1}/{steps.length}
              </span>
              <h2 id="tour-missing-title" className="mt-2 text-base font-extrabold text-ink">
                Không tìm thấy bước này
              </h2>
              <p id="tour-missing-body" className="mt-1.5 text-xs sm:text-sm text-ink/75">
                Phần tử hướng dẫn ({currentStep.title}) chưa xuất hiện trên màn hình hiện tại.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line/70 pt-3">
                <button
                  type="button"
                  onClick={() => finishTour("skipped")}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
                >
                  Kết thúc
                </button>
                <button
                  type="button"
                  onClick={handleAdvance}
                  className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-paper hover:bg-primary-strong cursor-pointer"
                >
                  Bỏ qua bước
                </button>
              </div>
            </div>
          )}

          {status === "confirm-exit" && (
            <div
              ref={confirmDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-exit-title"
              aria-describedby="tour-exit-body"
              tabIndex={-1}
              data-tour-popup="confirm-exit"
              className="fixed top-1/2 left-1/2 z-[9996] w-[320px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-paper p-5 shadow-soft outline-none"
            >
              <h2 id="tour-exit-title" className="text-base font-extrabold text-ink">
                Kết thúc hướng dẫn?
              </h2>
              <p id="tour-exit-body" className="mt-1.5 text-xs sm:text-sm text-ink/75">
                Bạn có thể mở lại hướng dẫn bất cứ lúc nào từ nút Hướng dẫn.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line/70 pt-3">
                <button
                  type="button"
                  onClick={() => setStatus(previousStatusBeforeExit)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
                >
                  Tiếp tục xem
                </button>
                <button
                  type="button"
                  onClick={() => finishTour("skipped")}
                  className="rounded-lg bg-brick px-3.5 py-1.5 text-xs font-bold text-paper hover:bg-brick-ink cursor-pointer"
                >
                  Kết thúc
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
