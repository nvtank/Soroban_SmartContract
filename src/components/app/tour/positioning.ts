import type {
  BlockerQuads,
  PopupPosition,
  PopupSize,
  TourPlacement,
  TourRect,
  ViewportSize,
} from "./types";

export const SPOTLIGHT_PADDING = 6;
/** Khoảng cách từ mép lỗ sáng đến mép popup. Tổng từ phần tử đích = 6 + 10 = 16 px (≤ 24 px). */
export const POPUP_GAP = 10;
export const VIEWPORT_MARGIN = 12;
export const MOBILE_BREAKPOINT = 640;
const ARROW_MIN_OFFSET = 22;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Tạo hình chữ nhật lỗ sáng quanh phần tử đích (cách `padding` px mỗi cạnh), kẹp trong khung nhìn.
 */
export function computeSpotlightBox(
  rect: TourRect,
  viewport: ViewportSize,
  padding = SPOTLIGHT_PADDING,
): TourRect {
  const left = Math.round(clamp(rect.left - padding, 0, viewport.width));
  const top = Math.round(clamp(rect.top - padding, 0, viewport.height));
  const right = Math.round(clamp(rect.right + padding, left, viewport.width));
  const bottom = Math.round(clamp(rect.bottom + padding, top, viewport.height));
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Dựng 4 khối phủ chặn mọi cú bấm nằm ngoài lỗ sáng.
 */
export function computeBlockerQuads(hole: TourRect, viewport: ViewportSize): BlockerQuads {
  const vw = Math.max(0, Math.round(viewport.width));
  const vh = Math.max(0, Math.round(viewport.height));
  const topH = Math.max(0, Math.min(vh, Math.round(hole.top)));
  const bottomTop = Math.max(topH, Math.min(vh, Math.round(hole.bottom)));
  const leftW = Math.max(0, Math.min(vw, Math.round(hole.left)));
  const rightLeft = Math.max(leftW, Math.min(vw, Math.round(hole.right)));
  const midH = Math.max(0, bottomTop - topH);

  return {
    top: { top: 0, left: 0, width: vw, height: topH },
    bottom: { top: bottomTop, left: 0, width: vw, height: Math.max(0, vh - bottomTop) },
    left: { top: topH, left: 0, width: leftW, height: midH },
    right: { top: topH, left: rightLeft, width: Math.max(0, vw - rightLeft), height: midH },
  };
}

type Side = "top" | "bottom" | "left" | "right";

function getCandidateOrder(preferred: TourPlacement): Side[] {
  const defaults: Side[] = ["bottom", "top", "right", "left"];
  if (preferred === "auto") return defaults;
  return [preferred, ...defaults.filter((s) => s !== preferred)];
}

/**
 * Tính tọa độ popup cạnh phần tử đích:
 * - < 640px: tấm dưới đáy màn hình (`sheet`).
 * - ≥ 640px: chọn phía đủ chỗ theo thứ tự ưu tiên, kẹp không tràn khung nhìn, kèm tọa độ mũi tên.
 */
export function computePopupPosition(
  targetRect: TourRect,
  popupSize: PopupSize,
  viewport: ViewportSize,
  preferredPlacement: TourPlacement = "auto",
  padding = SPOTLIGHT_PADDING,
): PopupPosition {
  if (viewport.width < MOBILE_BREAKPOINT) {
    // Tấm popup nằm ở đáy hoặc đỉnh màn hình, phía nào KHÔNG che vùng sáng.
    // (Nút đích trong hộp thoại cố định không cuộn được, nên không thể luôn đặt ở đáy.)
    const hole = computeSpotlightBox(targetRect, viewport, padding);
    const bottomTop = Math.round(viewport.height - popupSize.height - VIEWPORT_MARGIN);
    const fitsBelow = hole.bottom + POPUP_GAP <= bottomTop;
    const fitsAbove = hole.top - POPUP_GAP >= VIEWPORT_MARGIN + popupSize.height;
    const spaceBelow = viewport.height - hole.bottom;
    const useTop = !fitsBelow && (fitsAbove || hole.top > spaceBelow);
    return {
      top: useTop ? VIEWPORT_MARGIN : Math.max(VIEWPORT_MARGIN, bottomTop),
      left: VIEWPORT_MARGIN,
      placement: "sheet",
      arrowOffset: 0,
    };
  }

  const hole = computeSpotlightBox(targetRect, viewport, padding);
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const spaces: Record<Side, number> = {
    bottom: viewport.height - hole.bottom - VIEWPORT_MARGIN,
    top: hole.top - VIEWPORT_MARGIN,
    right: viewport.width - hole.right - VIEWPORT_MARGIN,
    left: hole.left - VIEWPORT_MARGIN,
  };

  const required: Record<Side, number> = {
    bottom: popupSize.height + POPUP_GAP,
    top: popupSize.height + POPUP_GAP,
    right: popupSize.width + POPUP_GAP,
    left: popupSize.width + POPUP_GAP,
  };

  const candidates = getCandidateOrder(preferredPlacement);
  let chosen: Side | null = null;

  for (const side of candidates) {
    if (spaces[side] >= required[side]) {
      chosen = side;
      break;
    }
  }

  if (!chosen) {
    // Không phía nào đủ trọn vẹn: chọn phía có không gian trống lớn nhất
    chosen = candidates.reduce((best, side) => (spaces[side] > spaces[best] ? side : best), candidates[0]);
  }

  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - popupSize.width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - popupSize.height - VIEWPORT_MARGIN);

  let top = VIEWPORT_MARGIN;
  let left = VIEWPORT_MARGIN;
  let arrowOffset = ARROW_MIN_OFFSET;

  if (chosen === "bottom") {
    top = clamp(hole.bottom + POPUP_GAP, VIEWPORT_MARGIN, maxTop);
    left = clamp(targetCenterX - popupSize.width / 2, VIEWPORT_MARGIN, maxLeft);
    arrowOffset = clamp(
      targetCenterX - left,
      ARROW_MIN_OFFSET,
      Math.max(ARROW_MIN_OFFSET, popupSize.width - ARROW_MIN_OFFSET),
    );
  } else if (chosen === "top") {
    top = clamp(hole.top - POPUP_GAP - popupSize.height, VIEWPORT_MARGIN, maxTop);
    left = clamp(targetCenterX - popupSize.width / 2, VIEWPORT_MARGIN, maxLeft);
    arrowOffset = clamp(
      targetCenterX - left,
      ARROW_MIN_OFFSET,
      Math.max(ARROW_MIN_OFFSET, popupSize.width - ARROW_MIN_OFFSET),
    );
  } else if (chosen === "right") {
    left = clamp(hole.right + POPUP_GAP, VIEWPORT_MARGIN, maxLeft);
    top = clamp(targetCenterY - popupSize.height / 2, VIEWPORT_MARGIN, maxTop);
    arrowOffset = clamp(
      targetCenterY - top,
      ARROW_MIN_OFFSET,
      Math.max(ARROW_MIN_OFFSET, popupSize.height - ARROW_MIN_OFFSET),
    );
  } else {
    left = clamp(hole.left - POPUP_GAP - popupSize.width, VIEWPORT_MARGIN, maxLeft);
    top = clamp(targetCenterY - popupSize.height / 2, VIEWPORT_MARGIN, maxTop);
    arrowOffset = clamp(
      targetCenterY - top,
      ARROW_MIN_OFFSET,
      Math.max(ARROW_MIN_OFFSET, popupSize.height - ARROW_MIN_OFFSET),
    );
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement: chosen,
    arrowOffset: Math.round(arrowOffset),
  };
}

/**
 * Kiểm tra hai hình chữ nhật có khác nhau đáng kể (> 0.5 px) để tránh đo & vẽ lại thừa mỗi frame.
 */
export function rectsSignificantlyDifferent(a: TourRect | null, b: TourRect | null): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  return (
    Math.abs(a.top - b.top) > 0.5 ||
    Math.abs(a.left - b.left) > 0.5 ||
    Math.abs(a.width - b.width) > 0.5 ||
    Math.abs(a.height - b.height) > 0.5
  );
}

/**
 * Kiểm tra phần tử có nằm gọn trong vùng dễ nhìn của khung nhìn hay cần cuộn vào giữa.
 */
export function needsScrollIntoView(
  rect: TourRect,
  viewport: ViewportSize,
  topSafeOffset = 120,
  bottomSafeOffset = 80,
): boolean {
  if (rect.height <= 0 || rect.width <= 0) return false;
  return rect.top < topSafeOffset || rect.bottom > viewport.height - bottomSafeOffset;
}
