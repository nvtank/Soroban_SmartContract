"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { AdminOnchainRow, Page } from "@/domain/admin/dto";
import { ONCHAIN_TX_STATUSES, type OnchainTxStatus } from "@/domain/states";
import { adminApi } from "@/lib/admin/api-client";
import {
  AnimatedNumber,
  buttonClass,
  cardClass,
  InlineConfirm,
  maskPhones,
  OpsEnter,
  OpsPage,
  Pagination,
  ResourceMessage,
  Timestamp,
  tones,
} from "./ops-ui";
import { adminFixturesEnabled, useOpsResource } from "./use-ops-resource";

const pageSize = 10;
const statuses = ONCHAIN_TX_STATUSES;
const statusLabels: Record<OnchainTxStatus, string> = {
  PENDING: "Chờ xử lý",
  SUBMITTED: "Đã gửi",
  CONFIRMED: "Đã xác nhận",
  FAILED: "Thất bại",
};
const statusTones = {
  PENDING: tones.warn,
  SUBMITTED: tones.neutral,
  CONFIRMED: tones.good,
  FAILED: tones.bad,
};
const desktopGrid =
  "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_6rem]";

type Queue = { counts: Record<OnchainTxStatus, number>; list: Page<AdminOnchainRow> };
type Filter = OnchainTxStatus | "";

async function loadQueue(
  filter: Filter,
  page: number,
  fixtureRetries: Map<string, AdminOnchainRow>,
): Promise<Queue> {
  if (adminFixturesEnabled) {
    const { items } = await adminApi.onchain({ pageSize: 100 });
    const rows = items.map((row) => fixtureRetries.get(row.id) ?? row);
    const [pending, submitted, confirmed, failed] = statuses.map(
      (status) => rows.filter((row) => row.status === status).length,
    );
    const filtered = filter ? rows.filter((row) => row.status === filter) : rows;
    return {
      counts: { PENDING: pending, SUBMITTED: submitted, CONFIRMED: confirmed, FAILED: failed },
      list: {
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        total: filtered.length,
        page,
        pageSize,
      },
    };
  }

  const result = adminApi.onchain({ page, pageSize, status: filter });
  const totals = statuses.map((status) =>
    (status === filter ? result : adminApi.onchain({ pageSize: 1, status })).then(({ total }) => total),
  );
  const [list, [pending, submitted, confirmed, failed]] = await Promise.all([result, Promise.all(totals)]);
  return { list, counts: { PENDING: pending, SUBMITTED: submitted, CONFIRMED: confirmed, FAILED: failed } };
}

function QueueField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs font-medium text-ink/65 xl:sr-only">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function OnchainOps() {
  const [filter, setFilter] = useState<Filter>("");
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [changed, setChanged] = useState<string>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fixtureRetries = useRef(new Map<string, AdminOnchainRow>());
  const load = useCallback(() => loadQueue(filter, page, fixtureRetries.current), [filter, page]);
  const { data, failed, reload, update } = useOpsResource(
    load,
    10_000,
    ({ counts }) => counts.PENDING + counts.SUBMITTED > 0,
  );
  const total = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : null;
  const lastPage = data ? Math.max(1, Math.ceil(data.list.total / data.list.pageSize)) : page;

  function selectStatus(status: Filter) {
    setFilter(status);
    setPage(1);
    setConfirming(undefined);
  }

  async function retry(row: AdminOnchainRow) {
    setPending(row.id);
    setError("");
    setNotice("");
    try {
      const result = await adminApi.retryOnchain(row.id);
      const next = adminFixturesEnabled
        ? { ...row, status: result.status, error: null, updatedAt: new Date().toISOString() }
        : result;
      if (adminFixturesEnabled) fixtureRetries.current.set(row.id, next);
      update((queue) => {
        const remains = !filter || filter === next.status;
        const wasInList = queue.list.items.some((item) => item.id === row.id && item.status === "FAILED");
        const statusChanged = next.status !== row.status && wasInList;
        const counts = statusChanged
          ? {
              ...queue.counts,
              FAILED: Math.max(0, queue.counts.FAILED - 1),
              [next.status]: queue.counts[next.status] + 1,
            }
          : queue.counts;
        return {
          counts,
          list: {
            ...queue.list,
            total: remains || !statusChanged ? queue.list.total : queue.list.total - 1,
            items: queue.list.items.flatMap((item) => (item.id !== row.id ? [item] : remains ? [next] : [])),
          },
        };
      });
      setChanged(row.id);
      setConfirming(undefined);
      setNotice(`Đã yêu cầu thử lại ${maskPhones(row.action)}. Trạng thái ${next.status}.`);
      if (filter) reload();
    } catch {
      setError("Không thể thử lại giao dịch. Hãy tải lại để kiểm tra trạng thái.");
    } finally {
      setPending(undefined);
    }
  }

  return (
    <OpsPage
      title="On-chain"
      description="Theo dõi hàng đợi giao dịch trên Stellar Testnet. Hàng đợi đang chạy tự làm mới mỗi 10 giây."
    >
      <OpsEnter className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(["", ...statuses] as const).map((status) => (
          <button
            type="button"
            key={status}
            data-ops-enter
            aria-pressed={filter === status}
            disabled={pending !== undefined}
            onClick={() => selectStatus(status)}
            className={`${cardClass} ${!status ? "col-span-2 lg:col-span-1" : ""} flex cursor-pointer flex-col gap-1 p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed sm:p-4 ${filter === status ? "border-primary bg-primary/10 ring-1 ring-primary/35" : ""}`}
          >
            <span className="text-xs font-bold tracking-wide">{status || "Tất cả"}</span>
            <span className="text-2xl font-bold">
              <AnimatedNumber value={status ? (data?.counts[status] ?? null) : total} />
            </span>
            {status && <span className="text-xs text-ink/65">{statusLabels[status]}</span>}
          </button>
        ))}
      </OpsEnter>
      <ResourceMessage failed={failed} hasData={!!data} reload={reload} />
      {notice && (
        <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary-strong">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-brick/10 px-4 py-3 text-sm text-brick-ink">
          {error}
        </p>
      )}
      {data && (
        <section className={`${cardClass} overflow-hidden`} aria-labelledby="queue-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:px-5">
            <h2 id="queue-heading" className="font-bold">
              Giao dịch
            </h2>
            <button type="button" className={buttonClass} onClick={reload} disabled={!!pending}>
              Làm mới
            </button>
          </div>
          {data.list.items.length > 0 ? (
            <>
              <div
                aria-hidden="true"
                className={`hidden gap-4 border-y border-line bg-surface/65 px-5 py-3 text-xs font-semibold text-ink/70 xl:grid ${desktopGrid}`}
              >
                <span>Hành động / Phòng</span>
                <span>Trạng thái</span>
                <span>Mã giao dịch</span>
                <span>Số lần thử lại</span>
                <span>Cập nhật</span>
                <span>Thao tác</span>
              </div>
              <ul
                aria-label="Danh sách giao dịch"
                className="divide-y divide-line border-y border-line xl:border-t-0"
              >
                {data.list.items.map((row) => (
                  <li key={row.id} className="px-4 py-3 sm:px-5">
                    <OpsEnter key={changed === row.id ? row.status : row.id}>
                      <dl
                        data-ops-enter
                        className={`grid grid-cols-2 items-start gap-x-3 gap-y-3 text-sm xl:items-center xl:gap-4 ${desktopGrid}`}
                      >
                        <div className="col-span-2 min-w-0 xl:col-span-1">
                          <dt className="sr-only">Hành động / Phòng</dt>
                          <dd className="[overflow-wrap:anywhere]">
                            <code className="font-semibold">{maskPhones(row.action)}</code>
                            <p className="mt-1 text-xs text-ink/65">
                              {row.roomLabel ? maskPhones(row.roomLabel) : "—"}
                            </p>
                          </dd>
                        </div>
                        <QueueField label="Trạng thái">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${statusTones[row.status]}`}
                            aria-label={statusLabels[row.status]}
                          >
                            {row.status}
                          </span>
                        </QueueField>
                        <QueueField label="Mã giao dịch">
                          {row.txHash ? (
                            <a
                              className="font-mono text-primary-strong underline"
                              href={`https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(row.txHash)}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Xem giao dịch trên Stellar Expert (mở tab mới)"
                              title={row.txHash}
                            >
                              {row.txHash.slice(0, 7)}…{row.txHash.slice(-5)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </QueueField>
                        <QueueField label="Số lần thử lại">
                          <AnimatedNumber value={row.retryCount} />
                        </QueueField>
                        <QueueField label="Cập nhật">
                          <Timestamp value={row.updatedAt} />
                        </QueueField>
                        <div>
                          <dt className="sr-only">Thao tác</dt>
                          <dd>
                            {row.status === "FAILED" && confirming !== row.id ? (
                              <button
                                type="button"
                                className={`${buttonClass} w-fit`}
                                disabled={!!pending}
                                onClick={() => {
                                  setConfirming(row.id);
                                  setError("");
                                }}
                              >
                                Thử lại
                              </button>
                            ) : (
                              <span aria-hidden="true" className="hidden xl:inline">
                                —
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      {row.error && (
                        <details className="group mt-2 text-sm text-brick-ink">
                          <summary className="cursor-pointer list-inside">
                            <span className="inline-block max-w-[calc(100%-1.5rem)] truncate align-middle group-open:hidden">
                              {maskPhones(row.error).slice(0, 72)}
                              {row.error.length > 72 ? "…" : ""}
                            </span>
                            <span className="hidden group-open:inline">Chi tiết lỗi</span>
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-brick/5 p-3 [overflow-wrap:anywhere]">
                            {maskPhones(row.error)}
                          </p>
                        </details>
                      )}
                      {row.status === "FAILED" && confirming === row.id && (
                        <div className="mt-3">
                          <InlineConfirm
                            prompt="Đưa giao dịch này trở lại hàng đợi?"
                            action="Xác nhận thử lại"
                            pending={pending === row.id}
                            onCancel={() => setConfirming(undefined)}
                            onConfirm={() => void retry(row)}
                          />
                        </div>
                      )}
                    </OpsEnter>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="border-t border-line px-5 py-8 text-sm text-ink/65">
              {page > lastPage ? "Không còn giao dịch ở trang này." : "Không có giao dịch ở trạng thái này."}
            </p>
          )}
          <div className="p-4 sm:px-5">
            {page > lastPage ? (
              <button type="button" className={buttonClass} onClick={() => setPage(lastPage)}>
                Về trang {lastPage}
              </button>
            ) : (
              <Pagination
                page={page}
                pageSize={data.list.pageSize}
                total={data.list.total}
                onPage={(nextPage) => {
                  if (!pending) {
                    setPage(nextPage);
                    setConfirming(undefined);
                  }
                }}
              />
            )}
          </div>
        </section>
      )}
    </OpsPage>
  );
}
