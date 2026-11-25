"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminContractRow, Page } from "@/domain/admin/dto";
import { CONTRACT_STATUSES, CONTRACT_STATUS_LABELS } from "@/domain/states";
import { adminApi, formatVnd } from "@/lib/admin/api-client";
import {
  AdminStatusPill,
  DataTable,
  DataTableFilterBar,
  DataTablePagination,
  useAdminListQuery,
  type ColumnDef,
  type FilterOption,
} from "@/components/admin/table";
import { AdminPageHeader } from "./AdminPageHeader";
import { sortRows } from "./formatters";

const STATUS_OPTIONS: FilterOption[] = [
  { value: "", label: "Tất cả trạng thái" },
  ...CONTRACT_STATUSES.map((s) => ({ value: s, label: CONTRACT_STATUS_LABELS[s] })),
];

export function ContractsListView() {
  const { query, sortState, setSearch, setStatus, setPage, toggleSort } = useAdminListQuery(20);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${query.page}|${query.pageSize}|${query.q ?? ""}|${query.status ?? ""}|${query.sort ?? ""}|${retryTick}`;
  const [state, setState] = useState<{
    key: string;
    data: Page<AdminContractRow> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const load = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .contracts(query)
      .then((res) => {
        if (active) setState({ key: requestKey, data: res, error: null });
      })
      .catch((err) => {
        if (active) {
          setState({
            key: requestKey,
            data: null,
            error: err instanceof Error ? err.message : "Không thể tải danh sách hợp đồng.",
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
      roomLabel: (r) => r.roomLabel,
      rentAmount: (r) => Number(r.rentAmount),
      depositAmount: (r) => Number(r.depositAmount),
      overduePeriods: (r) => r.overduePeriods,
    });
  }, [data?.items, sortState]);

  const columns = useMemo<ColumnDef<AdminContractRow>[]>(
    () => [
      {
        key: "roomLabel",
        header: "Phòng",
        sortable: true,
        isMobileTitle: true,
        cell: (row) => (
          <Link
            href={`/admin/hop-dong/${row.id}`}
            className="font-bold text-ink transition-colors hover:text-primary-strong hover:underline"
          >
            {row.roomLabel}
          </Link>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        cell: (row) => <AdminStatusPill kind="contract" status={row.status} />,
      },
      {
        key: "depositStatus",
        header: "Cọc",
        cell: (row) => <AdminStatusPill kind="deposit" status={row.depositStatus} />,
      },
      {
        key: "disputeStatus",
        header: "Tranh chấp",
        cell: (row) => <AdminStatusPill kind="dispute" status={row.disputeStatus} />,
      },
      {
        key: "landlordLabel",
        header: "Chủ nhà",
        cell: (row) => <span className="text-xs font-medium text-ink/85">{row.landlordLabel}</span>,
      },
      {
        key: "tenantLabel",
        header: "Người thuê",
        cell: (row) => (
          <span className="text-xs font-medium text-ink/85">
            {row.tenantLabel ?? "Chưa xác nhận"}
          </span>
        ),
      },
      {
        key: "rentAmount",
        header: "Tiền thuê",
        mobileLabel: "Tiền thuê (mô phỏng)",
        sortable: true,
        align: "right",
        cell: (row) => (
          <span className="tabular text-xs font-semibold text-ink whitespace-nowrap">
            {formatVnd(row.rentAmount)}
          </span>
        ),
      },
      {
        key: "depositAmount",
        header: "Tiền cọc",
        mobileLabel: "Tiền cọc (mô phỏng)",
        sortable: true,
        align: "right",
        cell: (row) => (
          <span className="tabular text-xs font-semibold text-ink whitespace-nowrap">
            {formatVnd(row.depositAmount)}
          </span>
        ),
      },
      {
        key: "overduePeriods",
        header: "Quá hạn",
        sortable: true,
        align: "center",
        cell: (row) =>
          row.overduePeriods > 0 ? (
            <span className="tabular inline-flex rounded-full border border-brick/35 bg-brick/12 px-2 py-0.5 text-xs font-bold text-brick-ink">
              {row.overduePeriods} kỳ
            </span>
          ) : (
            <span className="tabular text-xs text-ink/50">0</span>
          ),
      },
      {
        key: "onchain",
        header: "On-chain",
        align: "center",
        cell: (row) => (
          <span className="tabular font-mono text-xs font-semibold text-ink/80">
            {row.onchain.confirmed}/{row.onchain.total}
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
        title="Hợp đồng"
        subtitle="Chế độ chỉ xem; mọi số tiền thuê và tiền cọc đều là dữ liệu mô phỏng."
      />

      <DataTableFilterBar
        searchValue={query.q ?? ""}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo phòng hoặc chủ nhà..."
        filterLabel="Trạng thái"
        filterValue={query.status ?? ""}
        filterOptions={STATUS_OPTIONS}
        onFilterChange={setStatus}
        totalCount={data?.total}
        countLabel="hợp đồng"
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
        emptyTitle="Chưa có hợp đồng phù hợp"
        emptyDescription="Thử chọn trạng thái khác hoặc xóa từ khóa tìm kiếm."
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
