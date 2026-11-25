"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminUserRow, Page } from "@/domain/admin/dto";
import { adminApi } from "@/lib/admin/api-client";
import {
  AdminStatusPill,
  DataTable,
  DataTableFilterBar,
  DataTablePagination,
  useAdminListQuery,
  type ColumnDef,
  type FilterOption,
} from "@/components/admin/table";
import { AdminPageHeader } from "@/components/admin/shell/AdminPageHeader";
import { formatDate, formatRelativeTime, maskPhoneSafety, sortRows } from "./formatters";

const ROLE_OPTIONS: FilterOption[] = [
  { value: "", label: "Tất cả vai trò" },
  { value: "LANDLORD", label: "Chủ nhà" },
  { value: "TENANT", label: "Người thuê" },
  { value: "ADMIN_DEMO", label: "Quản trị" },
];

export function UsersListView() {
  const { query, sortState, setSearch, setRole, setPage, toggleSort } = useAdminListQuery(20);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${query.page}|${query.pageSize}|${query.q ?? ""}|${query.role ?? ""}|${query.sort ?? ""}|${retryTick}`;
  const [state, setState] = useState<{
    key: string;
    data: Page<AdminUserRow> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const load = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .users(query)
      .then((res) => {
        if (active) setState({ key: requestKey, data: res, error: null });
      })
      .catch((err) => {
        if (active) {
          setState({
            key: requestKey,
            data: null,
            error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải danh sách người dùng.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [query, requestKey]);

  const loading = state.key !== requestKey;
  const data = state.data;
  const error = loading ? null : state.error;

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    return sortRows(items, sortState, {
      fullName: (r) => r.fullName ?? "",
      createdAt: (r) => r.createdAt,
      lastActiveAt: (r) => r.lastActiveAt ?? "",
      contractCount: (r) => r.contractCount,
    });
  }, [data?.items, sortState]);

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        key: "fullName",
        header: "Người dùng",
        sortable: true,
        isMobileTitle: true,
        cell: (row) => (
          <Link
            href={`/admin/nguoi-dung/${row.id}`}
            className="font-bold text-ink transition-colors hover:text-primary-strong hover:underline"
          >
            {row.fullName ?? "Chưa cập nhật"}
          </Link>
        ),
      },
      {
        key: "phoneMasked",
        header: "Số điện thoại",
        cell: (row) => (
          <span className="tabular font-mono text-xs font-medium text-ink/80">
            {maskPhoneSafety(row.phoneMasked)}
          </span>
        ),
      },
      {
        key: "role",
        header: "Vai trò",
        cell: (row) => <AdminStatusPill kind="role" status={row.role} />,
      },
      {
        key: "createdAt",
        header: "Ngày tạo",
        sortable: true,
        cell: (row) => <span className="tabular text-xs text-ink/75">{formatDate(row.createdAt)}</span>,
      },
      {
        key: "lastActiveAt",
        header: "Hoạt động gần nhất",
        sortable: true,
        cell: (row) => (
          <span className="text-xs font-medium text-ink/75">
            {formatRelativeTime(row.lastActiveAt)}
          </span>
        ),
      },
      {
        key: "contractCount",
        header: "Hợp đồng",
        sortable: true,
        align: "right",
        cell: (row) => <span className="tabular font-semibold text-ink">{row.contractCount}</span>,
      },
      {
        key: "hasPasskey",
        header: "Passkey",
        align: "center",
        cell: (row) => <AdminStatusPill kind="passkey" enabled={row.hasPasskey} />,
      },
    ],
    [],
  );

  const animationKey = `${query.page}-${query.q ?? ""}-${query.role ?? ""}-${query.sort ?? ""}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title="Người dùng"
        description="Danh sách tài khoản chủ nhà và người thuê; số điện thoại luôn được che bớt."
      />

      <DataTableFilterBar
        searchValue={query.q ?? ""}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên hoặc số điện thoại đã che..."
        filterLabel="Vai trò"
        filterValue={query.role ?? ""}
        filterOptions={ROLE_OPTIONS}
        onFilterChange={setRole}
        totalCount={data?.total}
        countLabel="người dùng"
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={load}
        sort={sortState}
        onSortChange={toggleSort}
        animationKey={animationKey}
        emptyTitle="Chưa tìm thấy người dùng nào"
        emptyDescription="Thử xóa bộ lọc vai trò hoặc nhập từ khóa khác."
      />

      {data && !loading && !error && (
        <DataTablePagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
