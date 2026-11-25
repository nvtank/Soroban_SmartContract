import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  badge?: ReactNode;
};

/**
 * Tiêu đề trang tạm cho nhánh dữ liệu admin; Manager sẽ thay bằng AdminPageHeader chung của shell khi gộp.
 */
export function AdminPageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  badge,
}: AdminPageHeaderProps) {
  return (
    <header className="space-y-2">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/65 transition-colors hover:text-primary-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{backLabel ?? "Quay lại"}</span>
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {badge}
      </div>
      {subtitle && <p className="max-w-2xl text-sm text-ink/65">{subtitle}</p>}
    </header>
  );
}
