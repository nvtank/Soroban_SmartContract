"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { computeBlockerQuads, computeSpotlightBox, SPOTLIGHT_PADDING } from "./positioning";
import type { TourRect, ViewportSize } from "./types";

type TourOverlayProps = {
  targetRect: TourRect | null;
  viewport: ViewportSize;
  /** Khi đang ở trạng thái chờ, không tìm thấy hoặc xác nhận thoát: chặn toàn bộ nền. */
  fullBlock: boolean;
  reducedMotion: boolean;
};

function swallowEvent(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function TourOverlay({
  targetRect,
  viewport,
  fullBlock,
  reducedMotion,
}: TourOverlayProps) {
  const ringRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const hole = targetRect ? computeSpotlightBox(targetRect, viewport, SPOTLIGHT_PADDING) : null;
  const holeLeft = hole?.left ?? 0;
  const holeTop = hole?.top ?? 0;
  const holeWidth = hole?.width ?? 0;
  const holeHeight = hole?.height ?? 0;
  const hasHole = Boolean(hole);

  // Hiệu ứng GSAP trượt mượt khung sáng từ phần tử cũ sang phần tử mới
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring || !hasHole || fullBlock) {
      initializedRef.current = false;
      return;
    }

    if (reducedMotion || !initializedRef.current) {
      gsap.set(ring, {
        x: holeLeft,
        y: holeTop,
        width: holeWidth,
        height: holeHeight,
        opacity: 1,
      });
      initializedRef.current = true;
      return;
    }

    const tween = gsap.to(ring, {
      x: holeLeft,
      y: holeTop,
      width: holeWidth,
      height: holeHeight,
      opacity: 1,
      duration: 0.28,
      ease: "power2.out",
      overwrite: "auto",
    });

    return () => {
      tween.kill();
    };
  }, [hasHole, holeLeft, holeTop, holeWidth, holeHeight, fullBlock, reducedMotion]);

  if (fullBlock || !hole) {
    return (
      <div
        data-tour-blocker="full"
        className="fixed inset-0 z-[9990] bg-ink/55"
        onClick={swallowEvent}
        onMouseDown={swallowEvent}
        onPointerDown={swallowEvent}
        aria-hidden="true"
      />
    );
  }

  const quads = computeBlockerQuads(hole, viewport);

  return (
    <>
      {/* 4 khối chặn phủ tối xung quanh lỗ sáng: mọi cú bấm ngoài phần tử đích và popup đều bị chặn */}
      <div
        data-tour-blocker="top"
        className="fixed z-[9990] bg-ink/55"
        style={{
          top: quads.top.top,
          left: quads.top.left,
          width: quads.top.width,
          height: quads.top.height,
        }}
        onClick={swallowEvent}
        onMouseDown={swallowEvent}
        onPointerDown={swallowEvent}
        aria-hidden="true"
      />
      <div
        data-tour-blocker="bottom"
        className="fixed z-[9990] bg-ink/55"
        style={{
          top: quads.bottom.top,
          left: quads.bottom.left,
          width: quads.bottom.width,
          height: quads.bottom.height,
        }}
        onClick={swallowEvent}
        onMouseDown={swallowEvent}
        onPointerDown={swallowEvent}
        aria-hidden="true"
      />
      <div
        data-tour-blocker="left"
        className="fixed z-[9990] bg-ink/55"
        style={{
          top: quads.left.top,
          left: quads.left.left,
          width: quads.left.width,
          height: quads.left.height,
        }}
        onClick={swallowEvent}
        onMouseDown={swallowEvent}
        onPointerDown={swallowEvent}
        aria-hidden="true"
      />
      <div
        data-tour-blocker="right"
        className="fixed z-[9990] bg-ink/55"
        style={{
          top: quads.right.top,
          left: quads.right.left,
          width: quads.right.width,
          height: quads.right.height,
        }}
        onClick={swallowEvent}
        onMouseDown={swallowEvent}
        onPointerDown={swallowEvent}
        aria-hidden="true"
      />

      {/* Viền sáng bo góc quanh phần tử đích (trượt mượt bằng GSAP, không chặn bấm) */}
      <div
        ref={ringRef}
        data-tour-spotlight="1"
        className="pointer-events-none fixed top-0 left-0 z-[9991] rounded-xl border-2 border-primary shadow-[0_0_0_2px_rgba(251,248,243,0.9)] will-change-transform"
        aria-hidden="true"
      />
    </>
  );
}
