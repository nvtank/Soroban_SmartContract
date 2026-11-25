"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

function getPageNumbers(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = getPageNumbers(page, totalPages);

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="tabular text-xs font-medium text-ink/65">
        Hiển thị <span className="font-semibold text-ink">{from}–{to}</span> trên{" "}
        <span className="font-semibold text-ink">{total.toLocaleString("vi-VN")}</span> kết quả
      </p>

      <div className="flex items-center justify-between gap-1.5 sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Trước</span>
        </button>

        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((item, idx) =>
            item === "ellipsis" ? (
              <span key={`e-${idx}`} className="px-2 text-xs text-ink/45">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? "page" : undefined}
                className={`tabular min-w-8 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  item === page
                    ? "bg-primary text-paper"
                    : "border border-transparent text-ink/75 hover:border-line hover:bg-surface"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <span className="tabular text-xs font-semibold text-ink/70 sm:hidden">
          Trang {page}/{totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Trang sau"
          className="inline-flex items-center gap-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Sau</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
