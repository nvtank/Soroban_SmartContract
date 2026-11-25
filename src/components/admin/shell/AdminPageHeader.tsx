import Link from "next/link";
import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Liên kết quay lại (trang chi tiết). */
  backHref?: string;
  backLabel?: string;
  /** Huy hiệu cạnh tiêu đề, ví dụ vai trò hoặc trạng thái. */
  badge?: ReactNode;
};

/** Tiêu đề chung của mọi trang admin. */
export function AdminPageHeader({ title, description, actions, backHref, backLabel, badge }: AdminPageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink/65 transition-colors hover:text-primary-strong"
          >
            <span aria-hidden="true">←</span>
            <span>{backLabel ?? "Quay lại"}</span>
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight break-words text-ink sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-2 max-w-prose text-sm text-ink/70">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
