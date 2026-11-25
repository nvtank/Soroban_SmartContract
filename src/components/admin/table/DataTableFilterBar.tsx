"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { FilterOption } from "./types";

export type DataTableFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: FilterOption[];
  onFilterChange?: (value: string) => void;
  totalCount?: number;
  countLabel?: string;
};

export function DataTableFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  filterLabel,
  filterValue = "",
  filterOptions,
  onFilterChange,
  totalCount,
  countLabel = "mục",
}: DataTableFilterBarProps) {
  const [draft, setDraft] = useState<{ base: string; value: string }>({
    base: searchValue,
    value: searchValue,
  });

  const localSearch = draft.base === searchValue ? draft.value : searchValue;

  // Debounce 300ms khi gõ tìm kiếm
  useEffect(() => {
    const trimmed = localSearch.trim();
    if (trimmed === searchValue) return;
    const timer = window.setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [localSearch, onSearchChange, searchValue]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3.5 shadow-[0_6px_24px_-18px_rgb(20_33_61/0.2)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink/45"
            aria-hidden="true"
          />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setDraft({ base: searchValue, value: e.target.value })}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-xl border border-line bg-surface/55 py-2 pr-9 pl-10 text-sm text-ink placeholder:text-ink/45 focus:border-primary focus:bg-paper focus:outline-none"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setDraft({ base: searchValue, value: "" });
                onSearchChange("");
              }}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-ink/50 hover:bg-surface hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {filterOptions && onFilterChange && (
          <div className="flex items-center gap-2">
            {filterLabel && (
              <label htmlFor="admin-table-filter" className="shrink-0 text-xs font-semibold text-ink/65">
                {filterLabel}
              </label>
            )}
            <select
              id="admin-table-filter"
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              aria-label={filterLabel ?? "Lọc dữ liệu"}
              className="w-full rounded-xl border border-line bg-surface/55 px-3 py-2 text-sm font-medium text-ink focus:border-primary focus:bg-paper focus:outline-none sm:w-auto sm:min-w-[180px]"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {typeof totalCount === "number" && (
        <div className="tabular shrink-0 text-xs font-semibold text-ink/60">
          Tổng <span className="text-ink">{totalCount.toLocaleString("vi-VN")}</span> {countLabel}
        </div>
      )}
    </div>
  );
}
