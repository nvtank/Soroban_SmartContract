"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw } from "lucide-react";
import type { ColumnDef, SortState } from "./types";

gsap.registerPlugin(useGSAP);

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  sort?: SortState | null;
  onSortChange?: (key: string) => void;
  /** Khóa kích hoạt hiệu ứng xuất hiện so le khi đổi trang hoặc bộ lọc. */
  animationKey?: string;
  skeletonRows?: number;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Không có dữ liệu phù hợp",
  emptyDescription = "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.",
  sort = null,
  onSortChange,
  animationKey = "",
  skeletonRows = 6,
}: DataTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (loading || error || rows.length === 0) return;
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const isDesktop =
        typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
      const selector = isDesktop ? "tbody .admin-table-row" : "article.admin-table-row";
      const targets = containerRef.current?.querySelectorAll(selector);
      if (!targets || targets.length === 0) return;
      gsap.fromTo(
        targets,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.25,
          stagger: 0.018,
          ease: "power2.out",
          clearProps: "transform,opacity",
        },
      );
    },
    { scope: containerRef, dependencies: [animationKey, loading, rows.length] },
  );

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-brick/30 bg-brick/8 px-6 py-10 text-center"
      >
        <p className="text-base font-bold text-brick-ink">Không thể tải dữ liệu</p>
        <p className="max-w-md text-sm text-ink/70">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-brick/35 bg-paper px-4 py-2 text-sm font-semibold text-brick-ink transition-colors hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Thử lại</span>
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Đang tải dữ liệu" className="space-y-3">
        {/* Khung xương máy tính */}
        <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper md:block">
          <div className="border-b border-line bg-surface/65 px-4 py-3">
            <div className="h-4 w-48 animate-pulse rounded bg-ink/10" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: skeletonRows }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-4 px-4 py-3.5">
                {columns.map((col) => (
                  <div key={col.key} className="h-4 flex-1 animate-pulse rounded bg-ink/10" />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Khung xương điện thoại */}
        <div className="space-y-3 md:hidden">
          {Array.from({ length: Math.min(4, skeletonRows) }).map((_, idx) => (
            <div key={idx} className="space-y-2.5 rounded-2xl border border-line bg-paper p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-ink/10" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-ink/10" />
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-ink/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-paper px-6 py-12 text-center">
        <p className="text-base font-bold text-ink">{emptyTitle}</p>
        <p className="max-w-md text-sm text-ink/60">{emptyDescription}</p>
      </div>
    );
  }

  const titleColumn = columns.find((c) => c.isMobileTitle) ?? columns[0];
  const detailColumns = columns.filter((c) => c.key !== titleColumn.key && !c.hideOnMobile);

  return (
    <div ref={containerRef}>
      {/* Bảng trên máy tính */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-paper shadow-[0_10px_30px_-24px_rgb(20_33_61/0.22)] md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/60 text-xs font-bold tracking-wide text-ink/65 uppercase">
              {columns.map((col) => {
                const colSortKey = col.sortKey ?? col.key;
                const isSorted = sort?.key === colSortKey;
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left";
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3 whitespace-nowrap ${alignClass} ${col.className ?? ""}`}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(colSortKey)}
                        className={`inline-flex items-center gap-1.5 font-bold uppercase transition-colors hover:text-ink ${
                          col.align === "right" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary-strong" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-primary-strong" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="admin-table-row transition-colors hover:bg-surface/55"
              >
                {columns.map((col) => {
                  const alignClass =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left";
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 align-middle text-ink ${alignClass} ${col.className ?? ""}`}
                    >
                      {col.cell(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danh sách thẻ trên điện thoại */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={rowKey(row)}
            className="admin-table-row rounded-2xl border border-line bg-paper p-4 shadow-[0_6px_22px_-18px_rgb(20_33_61/0.22)]"
          >
            <div className="mb-3 border-b border-line/70 pb-2.5 text-base font-bold text-ink">
              {titleColumn.cell(row)}
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              {detailColumns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-xs font-semibold text-ink/55">
                    {col.mobileLabel ?? col.header}
                  </dt>
                  <dd className="min-w-0 text-right text-sm text-ink">{col.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
