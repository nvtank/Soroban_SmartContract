import type { StorageLike, TourProgress, TourRole, TourStep } from "./types";

export const TOUR_DISABLED_KEY = "rentflow.tour.disabled";
export const TOUR_PROGRESS_KEY = "rentflow.tour.progress.v1";
export const TOUR_START_EVENT = "rentflow:tour-start";

export function tourCompletedKey(role: TourRole): string {
  return `rentflow.tour.${role}.v1`;
}

export function mapUserRoleToTourRole(role?: string | null): TourRole | null {
  if (role === "TENANT") return "tenant";
  if (role === "LANDLORD") return "landlord";
  return null;
}

export function isTourDisabled(local: StorageLike | null): boolean {
  if (!local) return false;
  try {
    return local.getItem(TOUR_DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasFinishedTour(local: StorageLike | null, role: TourRole): boolean {
  if (!local) return false;
  try {
    const value = local.getItem(tourCompletedKey(role));
    return value === "completed" || value === "skipped" || value === "1";
  } catch {
    return false;
  }
}

export function loadTourProgress(session: StorageLike | null): TourProgress | null {
  if (!session) return null;
  try {
    const raw = session.getItem(TOUR_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TourProgress> | null;
    if (
      !parsed ||
      (parsed.role !== "tenant" && parsed.role !== "landlord") ||
      typeof parsed.stepIndex !== "number" ||
      !Number.isInteger(parsed.stepIndex) ||
      parsed.stepIndex < 0
    ) {
      return null;
    }
    return { role: parsed.role, stepIndex: parsed.stepIndex };
  } catch {
    return null;
  }
}

export function saveTourProgress(session: StorageLike | null, role: TourRole, stepIndex: number): void {
  if (!session) return;
  try {
    const safeIndex = Math.max(0, Math.floor(stepIndex));
    session.setItem(TOUR_PROGRESS_KEY, JSON.stringify({ role, stepIndex: safeIndex }));
  } catch {
    // Bỏ qua nếu bộ nhớ bị hạn chế
  }
}

export function clearTourProgress(session: StorageLike | null): void {
  if (!session) return;
  try {
    session.removeItem(TOUR_PROGRESS_KEY);
  } catch {
    // Bỏ qua
  }
}

export function markTourFinished(
  local: StorageLike | null,
  session: StorageLike | null,
  role: TourRole,
  reason: "completed" | "skipped",
): void {
  clearTourProgress(session);
  if (!local) return;
  try {
    local.setItem(tourCompletedKey(role), reason);
  } catch {
    // Bỏ qua
  }
}

/**
 * Quyết định có tự mở tour khi người dùng vừa vào `/app` hay không:
 * - Không tự mở khi `rentflow.tour.disabled === "1"` (dùng cho E2E cũ).
 * - Không tự mở khi vai trò này đã hoàn tất hoặc đã bỏ qua (`rentflow.tour.<vai>.v1`).
 * - Không tự mở mới nếu đang có tiến độ lưu sẵn trong `sessionStorage` (sẽ khôi phục riêng).
 */
export function shouldAutoStartTour(
  role: TourRole | null,
  local: StorageLike | null,
  session: StorageLike | null,
): boolean {
  if (!role) return false;
  if (isTourDisabled(local)) return false;
  if (hasFinishedTour(local, role)) return false;
  if (loadTourProgress(session)) return false;
  return true;
}

export function advanceStepIndex(
  currentIndex: number,
  totalSteps: number,
): { stepIndex: number; finished: boolean } {
  if (totalSteps <= 0 || currentIndex >= totalSteps - 1) {
    return { stepIndex: Math.max(0, totalSteps - 1), finished: true };
  }
  return { stepIndex: currentIndex + 1, finished: false };
}

export function previousStepIndex(currentIndex: number): number {
  return Math.max(0, currentIndex - 1);
}

/**
 * Nút "Tiếp theo" chỉ bật ở bước `info` hoặc bước `click` có `safeAutoClick: true`.
 * Bước `click` tác động thật (ký, nộp tiền, gửi form) buộc người dùng tự bấm nút được tô sáng.
 */
export function canUseNextButton(step: TourStep): boolean {
  if (step.mode === "info") return true;
  return Boolean(step.safeAutoClick);
}

/**
 * Tách số phòng ngắn (ví dụ "301", "402", "102") từ tên phòng để gắn vào `data-tour-key`.
 */
export function extractRoomTourKey(roomLabel: string): string {
  const match = roomLabel.match(/\b(\d{2,4}[A-Za-z]?)\b/);
  return match ? match[1] : roomLabel.trim();
}
