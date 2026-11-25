"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminPaymentRow, Page } from "@/domain/admin/dto";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "@/domain/states";
import { adminApi, formatVnd } from "@/lib/admin/api-client";
import { MockBadge } from "@/components/shared";
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
import { formatDateTime, sortRows } from "./formatters";

const STATUS_OPTIONS: FilterOption[] = [
  { value: "", label: "Tất cả trạng thái" },
  ...PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })),
];

export function PaymentsListView() {
  const { query, sortState, setSearch, setStatus, setPage, toggleSort } = useAdminListQuery(20);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${query.page}|${query.pageSize}|${query.q ?? ""}|${query.status ?? ""}|${query.sort ?? ""}|${retryTick}`;
  const [state, setState] = useState<{
    key: string;
    data: Page<AdminPaymentRow> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const load = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .payments(query)
      .then((res) => {
        if (active) setState({ key: requestKey, data: res, error: null });
      })
      .catch((err) => {
        if (active) {
          setState({
            key: requestKey,
            data: null,
            error: err instanceof Error ? err.message : "Không thể tải danh sách thanh toán.",
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
      expectedAmount: (r) => Number(r.expectedAmount),
      paidAmount: (r) => Number(r.paidAmount),
      createdAt: (r) => r.settledAt ?? r.createdAt,
    });
  }, [data?.items, sortState]);

  const columns = useMemo<ColumnDef<AdminPaymentRow>[]>(
    () => [
      {
        key: "roomLabel",
        header: "Phòng",
        isMobileTitle: true,
        cell: (row) => (
          <Link
            href={`/admin/hop-dong/${row.contractId}`}
            className="font-bold text-ink transition-colors hover:text-primary-strong hover:underline"
          >
            {row.roomLabel}
          </Link>
        ),
      },
      {
        key: "kind",
        header: "Loại",
        cell: (row) => <AdminStatusPill kind="paymentKind" value={row.kind} />,
      },
      {
        key: "periodNo",
        header: "Kỳ",
        align: "center",
        cell: (row) => (
          <span className="tabular text-xs font-medium text-ink/75">
            {row.periodNo !== null ? `Kỳ ${row.periodNo}` : "—"}
          </span>
        ),
      },
      {
        key: "expectedAmount",
        header: "Dự kiến (mô phỏng)",
        sortable: true,
        align: "right",
        cell: (row) => (
          <span className="tabular text-xs font-semibold text-ink whitespace-nowrap">
            {formatVnd(row.expectedAmount)}
          </span>
        ),
      },
      {
        key: "paidAmount",
        header: "Đã trả (mô phỏng)",
        sortable: true,
        align: "right",
        cell: (row) => (
          <span className="tabular text-xs font-semibold text-ink whitespace-nowrap">
            {formatVnd(row.paidAmount)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        cell: (row) => <AdminStatusPill kind="payment" status={row.status} />,
      },
      {
        key: "provider",
        header: "Nguồn",
        cell: (row) => (
          <AdminStatusPill kind="provider" isSimulated={row.isSimulated} provider={row.provider} />
        ),
      },
      {
        key: "createdAt",
        header: "Thời điểm",
        sortable: true,
        cell: (row) => (
          <span className="tabular text-xs text-ink/70 whitespace-nowrap">
            {formatDateTime(row.settledAt ?? row.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const animationKey = `${query.page}-${query.q ?? ""}-${query.status ?? ""}-${query.sort ?? ""}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title="Thanh toán (mô phỏng)"
        description="Theo dõi các lệnh thanh toán tiền cọc và tiền thuê; số tiền là dữ liệu mô phỏng, hợp đồng thông minh không giữ VND."
        badge={<MockBadge label="Tiền mô phỏng" />}
      />

      <DataTableFilterBar
        searchValue={query.q ?? ""}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên phòng..."
        filterLabel="Trạng thái"
        filterValue={query.status ?? ""}
        filterOptions={STATUS_OPTIONS}
        onFilterChange={setStatus}
        totalCount={data?.total}
        countLabel="giao dịch"
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
        emptyTitle="Chưa có giao dịch thanh toán phù hợp"
        emptyDescription="Thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm."
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
