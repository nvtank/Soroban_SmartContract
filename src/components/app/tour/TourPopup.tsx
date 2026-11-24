"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { computePopupPosition } from "./positioning";
import { canUseNextButton } from "./state";
import type { PopupPosition, PopupSize, TourRect, TourStep, ViewportSize } from "./types";

type TourPopupProps = {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: TourRect | null;
  viewport: ViewportSize;
  reducedMotion: boolean;
  popupRef: React.RefObject<HTMLDivElement | null>;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

const DEFAULT_POPUP_SIZE: PopupSize = { width: 340, height: 220 };

export function TourPopup({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  viewport,
  reducedMotion,
  popupRef,
  onNext,
  onPrev,
  onSkip,
}: TourPopupProps) {
  const [popupSize, setPopupSize] = useState<PopupSize>(DEFAULT_POPUP_SIZE);
  const animatedStepRef = useRef<string | null>(null);

  // Đo kích thước thật của popup mỗi khi đổi bước hoặc khung nhìn
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setPopupSize((prev) =>
        Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1
          ? { width: Math.round(rect.width), height: Math.round(rect.height) }
          : prev,
      );
    }
  }, [step.id, viewport.width, viewport.height, popupRef]);

  // Focus vào popup và chạy hiệu ứng hiện nhẹ khi sang bước mới
  useEffect(() => {
    const el = popupRef.current;
    if (!el) return;

    if (animatedStepRef.current !== step.id) {
      animatedStepRef.current = step.id;
      el.focus({ preventScroll: true });

      if (!reducedMotion) {
        gsap.fromTo(
          el,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.22, ease: "power2.out", overwrite: "auto" },
        );
      } else {
        gsap.set(el, { opacity: 1, y: 0 });
      }
    }
  }, [step.id, reducedMotion, popupRef]);

  const position: PopupPosition = targetRect
    ? computePopupPosition(targetRect, popupSize, viewport, step.placement ?? "auto")
    : {
        top: Math.max(16, Math.round((viewport.height - popupSize.height) / 2)),
        left: Math.max(16, Math.round((viewport.width - popupSize.width) / 2)),
        placement: "center",
        arrowOffset: 0,
      };

  const isSheet = position.placement === "sheet";
  const isLast = stepIndex >= totalSteps - 1;
  const allowNext = canUseNextButton(step);

  const arrowStyle: React.CSSProperties | null = (() => {
    if (isSheet || position.placement === "center") return null;
    if (position.placement === "bottom") {
      return { top: -6, left: position.arrowOffset - 6 };
    }
    if (position.placement === "top") {
      return { bottom: -6, left: position.arrowOffset - 6 };
    }
    if (position.placement === "right") {
      return { left: -6, top: position.arrowOffset - 6 };
    }
    return { right: -6, top: position.arrowOffset - 6 };
  })();

  const arrowBorderClass = (() => {
    if (position.placement === "bottom") return "border-t border-l border-line";
    if (position.placement === "top") return "border-b border-r border-line";
    if (position.placement === "right") return "border-b border-l border-line";
    return "border-t border-r border-line";
  })();

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-popup-title"
      aria-describedby="tour-popup-body"
      tabIndex={-1}
      data-tour-popup="1"
      data-tour-step={step.id}
      data-tour-placement={position.placement}
      className={
        isSheet
          ? "fixed inset-x-3 bottom-3 z-[9995] rounded-2xl border border-line bg-paper p-4 shadow-soft outline-none"
          : "fixed z-[9995] w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-paper p-5 shadow-soft outline-none"
      }
      style={isSheet ? undefined : { top: position.top, left: position.left }}
    >
      {/* Mũi tên chỉ vào phần tử đích (chỉ trên màn hình >= 640px) */}
      {arrowStyle && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute h-3 w-3 rotate-45 bg-paper ${arrowBorderClass}`}
          style={arrowStyle}
        />
      )}

      {/* Hàng đầu: bộ đếm bước + chấm tiến độ */}
      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          data-tour-counter="1"
          className="font-mono text-xs font-bold text-primary-strong"
        >
          {stepIndex + 1}/{totalSteps}
        </span>

        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === stepIndex
                  ? "w-4 bg-primary"
                  : idx < stepIndex
                    ? "w-1.5 bg-primary/45"
                    : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tiêu đề & nội dung giải thích */}
      <h2 id="tour-popup-title" className="mt-2.5 text-base font-extrabold leading-snug text-ink">
        {step.title}
      </h2>
      <p id="tour-popup-body" className="mt-1.5 text-xs sm:text-sm leading-relaxed text-ink/75">
        {step.body}
      </p>

      {/* Ghi chú bắt buộc cho bước click có tác động thật */}
      {!allowNext && (
        <p
          data-tour-manual-hint="1"
          className="mt-2.5 rounded-lg border border-amber/40 bg-amber/15 px-2.5 py-1.5 text-xs font-semibold text-amber-ink"
        >
          Bấm nút được tô sáng để thực hiện
        </p>
      )}

      {/* Các nút điều hướng */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/70 pt-3">
        <button
          type="button"
          onClick={onSkip}
          data-tour-action="skip"
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink/65 hover:bg-surface hover:text-ink transition-colors cursor-pointer"
        >
          Bỏ qua
        </button>

        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={onPrev}
              data-tour-action="prev"
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface transition-colors cursor-pointer"
            >
              Quay lại
            </button>
          )}

          <button
            type="button"
            onClick={onNext}
            disabled={!allowNext}
            data-tour-action="next"
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
              allowNext
                ? "bg-primary text-paper hover:bg-primary-strong cursor-pointer shadow-xs"
                : "bg-line text-ink/45 cursor-not-allowed opacity-60"
            }`}
          >
            {isLast ? "Hoàn tất" : "Tiếp theo"}
          </button>
        </div>
      </div>
    </div>
  );
}
