export type TourRole = "tenant" | "landlord";

export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right";

export type ResolvedPlacement = "top" | "bottom" | "left" | "right" | "sheet" | "center";

export type TourStep = {
  id: string;
  target: string;
  /** Bộ chọn dự phòng khi chạy chế độ dữ liệu mẫu (mock) với mã phòng khác. */
  fallbackTargets?: string[];
  title: string;
  body: string;
  mode: "info" | "click";
  safeAutoClick?: boolean;
  route?: RegExp;
  placement?: TourPlacement;
};

export type TourRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type PopupSize = {
  width: number;
  height: number;
};

export type PopupPosition = {
  top: number;
  left: number;
  placement: ResolvedPlacement;
  /** Vị trí mũi tên tính từ cạnh trái (top/bottom) hoặc cạnh trên (left/right) của popup. */
  arrowOffset: number;
};

export type BlockerQuad = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type BlockerQuads = {
  top: BlockerQuad;
  bottom: BlockerQuad;
  left: BlockerQuad;
  right: BlockerQuad;
};

export type TourProgress = {
  role: TourRole;
  stepIndex: number;
};

export type TourStatus = "idle" | "waiting" | "ready" | "missing" | "confirm-exit";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
