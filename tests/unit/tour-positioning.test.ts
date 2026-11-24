import { describe, expect, it } from "vitest";
import {
  computeBlockerQuads,
  computePopupPosition,
  computeSpotlightBox,
  needsScrollIntoView,
  POPUP_GAP,
  rectsSignificantlyDifferent,
  SPOTLIGHT_PADDING,
  VIEWPORT_MARGIN,
} from "@/components/app/tour/positioning";
import type { TourRect } from "@/components/app/tour/types";

function makeRect(left: number, top: number, width: number, height: number): TourRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe("tour positioning logic", () => {
  it("expands spotlight box by 6px padding and clamps to viewport", () => {
    const hole = computeSpotlightBox(makeRect(100, 200, 180, 44), { width: 1440, height: 900 });
    expect(hole).toEqual({
      left: 94,
      top: 194,
      right: 286,
      bottom: 250,
      width: 192,
      height: 56,
    });

    const edgeHole = computeSpotlightBox(makeRect(2, 3, 100, 40), { width: 390, height: 844 });
    expect(edgeHole.left).toBe(0);
    expect(edgeHole.top).toBe(0);
    expect(edgeHole.right).toBe(108);
    expect(edgeHole.bottom).toBe(49);
  });

  it("builds 4 non-overlapping blocker quads surrounding the spotlight hole", () => {
    const viewport = { width: 1440, height: 900 };
    const hole = computeSpotlightBox(makeRect(200, 300, 120, 40), viewport);
    const quads = computeBlockerQuads(hole, viewport);

    expect(quads.top).toEqual({ top: 0, left: 0, width: 1440, height: hole.top });
    expect(quads.bottom).toEqual({
      top: hole.bottom,
      left: 0,
      width: 1440,
      height: 900 - hole.bottom,
    });
    expect(quads.left).toEqual({ top: hole.top, left: 0, width: hole.left, height: hole.height });
    expect(quads.right).toEqual({
      top: hole.top,
      left: hole.right,
      width: 1440 - hole.right,
      height: hole.height,
    });
  });

  it("places popup below target on desktop when enough space exists and keeps distance <= 24px", () => {
    const viewport = { width: 1440, height: 900 };
    const target = makeRect(500, 200, 180, 44);
    const popup = { width: 340, height: 200 };

    const pos = computePopupPosition(target, popup, viewport, "auto");
    expect(pos.placement).toBe("bottom");
    expect(pos.top - target.bottom).toBe(SPOTLIGHT_PADDING + POPUP_GAP);
    expect(pos.top - target.bottom).toBeLessThanOrEqual(24);
    expect(pos.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(pos.left + popup.width).toBeLessThanOrEqual(viewport.width - VIEWPORT_MARGIN);
  });

  it("flips to top when target is near bottom edge of viewport", () => {
    const viewport = { width: 1440, height: 900 };
    const target = makeRect(500, 810, 180, 44);
    const popup = { width: 340, height: 200 };

    const pos = computePopupPosition(target, popup, viewport, "bottom");
    expect(pos.placement).toBe("top");
    expect(target.top - (pos.top + popup.height)).toBe(SPOTLIGHT_PADDING + POPUP_GAP);
    expect(pos.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  });

  it("uses right or left placement when preferred and space allows", () => {
    const viewport = { width: 1440, height: 900 };
    const target = makeRect(200, 400, 160, 44);
    const popup = { width: 340, height: 180 };

    const rightPos = computePopupPosition(target, popup, viewport, "right");
    expect(rightPos.placement).toBe("right");
    expect(rightPos.left - target.right).toBe(SPOTLIGHT_PADDING + POPUP_GAP);

    const nearRightTarget = makeRect(1240, 400, 160, 44);
    const leftPos = computePopupPosition(nearRightTarget, popup, viewport, "right");
    expect(leftPos.placement).toBe("bottom");

    const explicitLeft = computePopupPosition(nearRightTarget, popup, viewport, "left");
    expect(explicitLeft.placement).toBe("left");
    expect(nearRightTarget.left - (explicitLeft.left + popup.width)).toBe(SPOTLIGHT_PADDING + POPUP_GAP);
  });

  it("clamps popup inside viewport horizontally when target is near left or right edge", () => {
    const viewport = { width: 1024, height: 768 };
    const popup = { width: 340, height: 180 };

    const leftEdgeTarget = makeRect(10, 150, 80, 40);
    const posLeft = computePopupPosition(leftEdgeTarget, popup, viewport, "bottom");
    expect(posLeft.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);

    const rightEdgeTarget = makeRect(940, 150, 70, 40);
    const posRight = computePopupPosition(rightEdgeTarget, popup, viewport, "bottom");
    expect(posRight.left + popup.width).toBeLessThanOrEqual(viewport.width - VIEWPORT_MARGIN);
  });

  it("switches to bottom sheet on mobile viewports (< 640px)", () => {
    const pos = computePopupPosition(
      makeRect(20, 120, 350, 50),
      { width: 360, height: 220 },
      { width: 390, height: 844 },
      "bottom",
    );
    expect(pos.placement).toBe("sheet");
    expect(pos.left).toBe(VIEWPORT_MARGIN);
  });

  it("detects rect changes and scroll-into-view threshold accurately", () => {
    const r1 = makeRect(100, 200, 150, 40);
    const r2 = makeRect(100.2, 200.1, 150, 40);
    const r3 = makeRect(102, 200, 150, 40);

    expect(rectsSignificantlyDifferent(r1, r2)).toBe(false);
    expect(rectsSignificantlyDifferent(r1, r3)).toBe(true);
    expect(needsScrollIntoView(makeRect(100, 40, 120, 40), { width: 1280, height: 800 })).toBe(true);
    expect(needsScrollIntoView(makeRect(100, 300, 120, 40), { width: 1280, height: 800 })).toBe(false);
    expect(needsScrollIntoView(makeRect(100, 760, 120, 50), { width: 1280, height: 800 })).toBe(true);
  });
});
