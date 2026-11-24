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
      className={`animate-pulse space-y-4 rounded-3xl border border-line bg-surface/40 p-6 sm:p-8 ${className}`}
    >
      <div className="h-6 w-1/3 rounded-lg bg-line/40" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg bg-line/25"
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
      className="flex flex-col items-center justify-center rounded-3xl border border-line bg-surface/40 p-8 sm:p-12 text-center"
    >
      <h3 className="text-lg sm:text-xl font-extrabold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-ink/65">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-paper transition-colors hover:bg-ink/90 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Không tải được dữ liệu",
  message = "Vui lòng kiểm tra kết nối và thử lại.",
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
      className="flex flex-col items-center justify-center rounded-3xl border border-brick/30 bg-brick/8 p-6 sm:p-10 text-center text-ink"
    >
      <h3 className="text-base sm:text-lg font-extrabold text-brick-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-ink/75">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-brick px-5 py-2 text-sm font-bold text-paper transition-colors hover:bg-brick-ink cursor-pointer"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
