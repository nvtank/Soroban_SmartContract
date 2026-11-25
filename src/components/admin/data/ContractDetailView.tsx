"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import type {
  AdminContractDetailDto,
  AdminOnchainRow,
  AdminPaymentRow,
} from "@/domain/admin/dto";
import { adminApi, formatVnd } from "@/lib/admin/api-client";
import { AdminStatusPill, DataTable, type ColumnDef } from "@/components/admin/table";
import { AdminPageHeader } from "./AdminPageHeader";
import { DetailSkeleton } from "./DetailSkeleton";
import { EventTimeline } from "./EventTimeline";
import {
  formatDate,
  formatDateTime,
  stellarTxUrl,
  truncateMiddle,
} from "./formatters";

type ContractPeriod = AdminContractDetailDto["periods"][number];

export function ContractDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${id}|${retryTick}`;
  const [state, setState] = useState<{
    key: string;
    contract: AdminContractDetailDto | null;
    error: string | null;
  }>({ key: "", contract: null, error: null });

  const load = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .contract(id)
      .then((res) => {
        if (active) setState({ key: requestKey, contract: res, error: null });
      })
      .catch((err) => {
        if (active) {
          setState({
            key: requestKey,
            contract: null,
            error: err instanceof Error ? err.message : "Không thể tải chi tiết hợp đồng.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [id, requestKey]);

  const loading = state.key !== requestKey;
  const contract = loading ? null : state.contract;
  const error = loading ? null : state.error;

  const periodColumns = useMemo<ColumnDef<ContractPeriod>[]>(
    () => [
      {
        key: "periodNo",
        header: "Kỳ thuê",
        isMobileTitle: true,
        cell: (row) => <span className="tabular font-bold text-ink">Kỳ {row.periodNo}</span>,
      },
      {
        key: "dueDate",
        header: "Hạn đóng",
        cell: (row) => <span className="tabular text-xs text-ink/75">{formatDate(row.dueDate)}</span>,
      },
      {
        key: "amountDue",
        header: "Phải nộp (mô phỏng)",
        align: "right",
        cell: (row) => <span className="tabular font-semibold">{formatVnd(row.amountDue)}</span>,
      },
      {
        key: "amountPaid",
        header: "Đã nộp (mô phỏng)",
        align: "right",
        cell: (row) => <span className="tabular font-semibold">{formatVnd(row.amountPaid)}</span>,
      },
      {
        key: "lateFee",
        header: "Phí trễ (mô phỏng)",
        align: "right",
        cell: (row) => (
          <span className={`tabular text-xs font-semibold ${Number(row.lateFee) > 0 ? "text-brick-ink" : "text-ink/55"}`}>
            {formatVnd(row.lateFee)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        cell: (row) => <AdminStatusPill kind="rent" status={row.status} />,
      },
    ],
    [],
  );

  const paymentColumns = useMemo<ColumnDef<AdminPaymentRow>[]>(
    () => [
      {
        key: "kind",
        header: "Loại",
        isMobileTitle: true,
        cell: (row) => <AdminStatusPill kind="paymentKind" value={row.kind} />,
      },
      {
        key: "periodNo",
        header: "Kỳ",
        cell: (row) => (
          <span className="tabular text-xs text-ink/75">
            {row.periodNo !== null ? `Kỳ ${row.periodNo}` : "—"}
          </span>
        ),
      },
      {
        key: "expectedAmount",
        header: "Dự kiến (mô phỏng)",
        align: "right",
        cell: (row) => <span className="tabular font-semibold">{formatVnd(row.expectedAmount)}</span>,
      },
      {
        key: "paidAmount",
        header: "Đã trả (mô phỏng)",
        align: "right",
        cell: (row) => <span className="tabular font-semibold">{formatVnd(row.paidAmount)}</span>,
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
        key: "time",
        header: "Thời điểm",
        cell: (row) => (
          <span className="tabular text-xs text-ink/70">
            {formatDateTime(row.settledAt ?? row.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const onchainColumns = useMemo<ColumnDef<AdminOnchainRow>[]>(
    () => [
      {
        key: "action",
        header: "Hành động",
        isMobileTitle: true,
        cell: (row) => <code className="font-mono text-xs font-semibold text-ink">{row.action}</code>,
      },
      {
        key: "status",
        header: "Trạng thái",
        cell: (row) => <AdminStatusPill kind="onchain" status={row.status} />,
      },
      {
        key: "txHash",
        header: "Giao dịch Stellar",
        cell: (row) => {
          const url = row.explorerUrl ?? (row.txHash ? stellarTxUrl(row.txHash) : null);
          if (!row.txHash || !url) {
            return <span className="text-xs text-ink/50">Chưa có mã giao dịch</span>;
          }
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary-strong hover:underline"
            >
              <span>{truncateMiddle(row.txHash, 8, 6)}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          );
        },
      },
      {
        key: "retryCount",
        header: "Thử lại",
        align: "center",
        cell: (row) => <span className="tabular text-xs text-ink/75">{row.retryCount}</span>,
      },
      {
        key: "createdAt",
        header: "Thời điểm",
        cell: (row) => <span className="tabular text-xs text-ink/70">{formatDateTime(row.createdAt)}</span>,
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <AdminPageHeader
          title="Chi tiết hợp đồng"
          backHref="/admin/hop-dong"
          backLabel="Quay lại danh sách hợp đồng"
        />
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-brick/30 bg-brick/8 px-6 py-10 text-center"
        >
          <p className="text-base font-bold text-brick-ink">Không thể tải chi tiết hợp đồng</p>
          <p className="text-sm text-ink/70">{error ?? "Không tìm thấy hợp đồng."}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-brick/35 bg-paper px-4 py-2 text-sm font-semibold text-brick-ink hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title={contract.roomLabel}
        subtitle="Chế độ chỉ xem; mọi khoản tiền trong bản demo đều là mô phỏng."
        backHref="/admin/hop-dong"
        backLabel="Quay lại danh sách hợp đồng"
        badge={<AdminStatusPill kind="contract" status={contract.status} />}
      />

      {/* Nguyên tắc vận hành: admin không phân xử tranh chấp */}
      <p className="rounded-2xl border border-line bg-surface/65 px-4 py-3 text-xs font-medium text-ink/75">
        Admin không phân xử tranh chấp. Tranh chấp chỉ kết thúc khi hai bên cùng đồng ý.
      </p>

      {/* Tóm tắt hợp đồng */}
      <section className="rounded-3xl border border-line bg-paper p-5 shadow-[0_10px_30px_-24px_rgb(20_33_61/0.22)]">
        <h2 className="mb-4 text-base font-bold text-ink">Tóm tắt hợp đồng</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold text-ink/55">Chủ nhà</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{contract.landlordLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Người thuê</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {contract.tenantLabel ?? "Chưa xác nhận"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Tiền thuê / tháng (mô phỏng)</dt>
            <dd className="tabular mt-1 text-sm font-bold text-ink">
              {formatVnd(contract.rentAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Tiền cọc (mô phỏng)</dt>
            <dd className="tabular mt-1 text-sm font-bold text-ink">
              {formatVnd(contract.depositAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Trạng thái tiền cọc</dt>
            <dd className="mt-1">
              <AdminStatusPill kind="deposit" status={contract.depositStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Tranh chấp</dt>
            <dd className="mt-1">
              <AdminStatusPill kind="dispute" status={contract.disputeStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Kỳ quá hạn / On-chain</dt>
            <dd className="tabular mt-1 text-sm font-semibold text-ink">
              {contract.overduePeriods} kỳ ·{" "}
              <span className="font-mono">
                {contract.onchain.confirmed}/{contract.onchain.total}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Ngày tạo</dt>
            <dd className="tabular mt-1 text-sm font-semibold text-ink">
              {formatDate(contract.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Bảng kỳ thuê */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-ink">Các kỳ thuê</h2>
          <p className="text-xs text-ink/60">Lịch đóng tiền thuê và phí trễ hạn (mô phỏng).</p>
        </div>
        <DataTable
          columns={periodColumns}
          rows={contract.periods}
          rowKey={(p) => String(p.periodNo)}
          animationKey={`periods-${contract.id}`}
          emptyTitle="Chưa có kỳ thuê nào"
          emptyDescription="Hợp đồng này chưa phát sinh kỳ thanh toán tiền thuê."
        />
      </section>

      {/* Thanh toán */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-ink">Lịch sử thanh toán (mô phỏng)</h2>
          <p className="text-xs text-ink/60">Các lệnh thanh toán tiền cọc và tiền thuê gắn với hợp đồng.</p>
        </div>
        <DataTable
          columns={paymentColumns}
          rows={contract.payments}
          rowKey={(p) => p.id}
          animationKey={`payments-${contract.id}`}
          emptyTitle="Chưa có giao dịch thanh toán"
          emptyDescription="Chưa ghi nhận thanh toán nào cho hợp đồng này."
        />
      </section>

      {/* Giao dịch on-chain */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-ink">Giao dịch on-chain (Stellar Testnet)</h2>
          <p className="text-xs text-ink/60">Bằng chứng ghi nhận trạng thái hợp đồng trên chuỗi công khai.</p>
        </div>
        <DataTable
          columns={onchainColumns}
          rows={contract.onchainTxs}
          rowKey={(t) => t.id}
          animationKey={`onchain-${contract.id}`}
          emptyTitle="Chưa có giao dịch on-chain"
          emptyDescription="Hợp đồng chưa có bản ghi giao dịch trên Stellar Testnet."
        />
      </section>

      {/* Dòng sự kiện */}
      <EventTimeline events={contract.events} title="Sự kiện của hợp đồng" />
    </div>
  );
}
