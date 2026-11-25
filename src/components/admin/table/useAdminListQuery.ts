"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListQuery } from "@/domain/admin/dto";
import type { SortState } from "./types";

const DEFAULT_PAGE_SIZE = 20;

export function parseSortParam(raw: string | undefined): SortState | null {
  if (!raw) return null;
  const [key, dir] = raw.split(":");
  if (!key) return null;
  return { key, dir: dir === "asc" ? "asc" : "desc" };
}

export function formatSortParam(sort: SortState | null): string {
  return sort ? `${sort.key}:${sort.dir}` : "";
}

/**
 * Đồng bộ trạng thái lọc, tìm kiếm, sắp xếp và phân trang với URL (?page&q&status&role&sort).
 * Component dùng hook này phải nằm trong <Suspense> (yêu cầu Next.js 16 cacheComponents).
 */
export function useAdminListQuery(defaultPageSize = DEFAULT_PAGE_SIZE) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = useMemo<Required<Pick<ListQuery, "page" | "pageSize">> & ListQuery>(() => {
    const rawPage = Number(searchParams.get("page") ?? "1");
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const rawSize = Number(searchParams.get("pageSize") ?? String(defaultPageSize));
    const pageSize =
      Number.isFinite(rawSize) && rawSize >= 5 && rawSize <= 100
        ? Math.floor(rawSize)
        : defaultPageSize;

    const q = searchParams.get("q") ?? "";
    const status = searchParams.get("status") ?? "";
    const role = searchParams.get("role") ?? "";
    const sort = searchParams.get("sort") ?? "";

    return {
      page,
      pageSize,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(sort ? { sort } : {}),
    };
  }, [searchParams, defaultPageSize]);

  const sortState = useMemo(() => parseSortParam(query.sort), [query.sort]);

  const updateParams = useCallback(
    (patch: Partial<Record<"page" | "pageSize" | "q" | "status" | "role" | "sort", string | number | undefined>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || (k === "page" && Number(v) <= 1)) {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      }
      const qs = next.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if ((query.q ?? "") === trimmed) return;
      updateParams({ q: trimmed, page: 1 });
    },
    [query.q, updateParams],
  );

  const setStatus = useCallback(
    (status: string) => {
      if ((query.status ?? "") === status) return;
      updateParams({ status, page: 1 });
    },
    [query.status, updateParams],
  );

  const setRole = useCallback(
    (role: string) => {
      if ((query.role ?? "") === role) return;
      updateParams({ role, page: 1 });
    },
    [query.role, updateParams],
  );

  const setPage = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.floor(page));
      if (query.page === safePage) return;
      updateParams({ page: safePage });
    },
    [query.page, updateParams],
  );

  const toggleSort = useCallback(
    (key: string) => {
      let nextSort: SortState | null;
      if (!sortState || sortState.key !== key) {
        nextSort = { key, dir: "asc" };
      } else if (sortState.dir === "asc") {
        nextSort = { key, dir: "desc" };
      } else {
        nextSort = null;
      }
      updateParams({ sort: formatSortParam(nextSort), page: 1 });
    },
    [sortState, updateParams],
  );

  return {
    query,
    sortState,
    setSearch,
    setStatus,
    setRole,
    setPage,
    toggleSort,
  };
}
