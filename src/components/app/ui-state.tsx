import React from "react";

export function LoadingSkeleton({
  lines = 4,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Đang tải dữ liệu"
      className={`animate-pulse space-y-4 p-6 bg-surface/40 rounded-card border border-line ${className}`}
    >
      <div className="h-6 bg-line/30 rounded-md w-1/3 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-line/20 rounded-md"
          style={{ width: `${85 - (i % 3) * 15}%` }}
        />
      ))}
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}

export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "Danh sách hiện đang trống hoặc không có mục nào phù hợp.",
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="region"
      aria-label={title}
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-card bg-surface/50 border border-line"
    >
      <div className="w-14 h-14 rounded-full bg-paper flex items-center justify-center border border-line mb-4 shadow-xs text-ink/40 text-2xl">
        📭
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-ink mb-1.5">{title}</h3>
      <p className="text-ink/60 text-sm sm:text-base max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 rounded-xl bg-primary text-paper font-semibold hover:bg-primary-strong transition-all shadow-xs cursor-pointer focus-visible:outline-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Đã xảy ra lỗi",
  message = "Không thể tải dữ liệu vào lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="p-6 sm:p-8 rounded-card bg-brick/10 border border-brick/30 text-ink text-center flex flex-col items-center justify-center"
    >
      <div className="w-12 h-12 rounded-full bg-brick/20 text-brick flex items-center justify-center text-xl font-bold mb-3">
        ⚠️
      </div>
      <h3 className="text-lg font-bold text-brick mb-1">{title}</h3>
      <p className="text-sm sm:text-base text-ink/80 max-w-md mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-xl bg-brick text-paper font-semibold hover:bg-brick-ink transition-all shadow-xs cursor-pointer focus-visible:outline-2"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
