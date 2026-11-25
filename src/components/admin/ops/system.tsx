"use client";

import { useState, type ReactNode } from "react";
import { adminApi } from "@/lib/admin/api-client";
import {
  AnimatedNumber,
  buttonClass,
  cardClass,
  numberFormat,
  OpsEnter,
  OpsPage,
  primaryButtonClass,
  ResourceMessage,
  StatusDot,
  Timestamp,
  tones,
} from "./ops-ui";
import { adminFixturesEnabled, useOpsResource } from "./use-ops-resource";

type Tone = keyof typeof tones;
type Job = "overdue" | "flush";

const jobs = {
  overdue: { label: "Quét kỳ quá hạn", run: adminApi.runOverdueScan },
  flush: { label: "Đẩy hàng đợi on-chain", run: adminApi.flushOnchain },
};
const paymentModes: Record<string, string> = {
  simulated: "Mô phỏng",
  payos: "payOS",
  both: "payOS và mô phỏng",
};

function HealthCard({
  title,
  tone,
  status,
  children,
}: {
  title: string;
  tone: Tone;
  status: string;
  children: ReactNode;
}) {
  return (
    <article data-ops-enter className={`${cardClass} space-y-3 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        <StatusDot tone={tone} label={status} />
      </div>
      {children}
    </article>
  );
}

function Metric({ value, unit }: { value: number | null; unit?: string }) {
  return (
    <p className="text-2xl font-bold [overflow-wrap:anywhere]">
      <AnimatedNumber value={value} />
      {value !== null && unit && <span className="ml-1.5 text-xs font-semibold text-ink/65">{unit}</span>}
    </p>
  );
}

function WalletCard({ title, balance, low }: { title: string; balance: number | null; low: boolean }) {
  return (
    <HealthCard
      title={title}
      tone={balance === null ? "neutral" : low ? "warn" : "good"}
      status={balance === null ? "Chưa rõ" : low ? "Cảnh báo" : "Đủ số dư"}
    >
      <Metric value={balance} unit="XLM testnet" />
    </HealthCard>
  );
}

function summarizeJob(job: Job, result: unknown) {
  if (adminFixturesEnabled) return `${jobs[job].label} hoàn tất với dữ liệu mẫu.`;
  if (typeof result !== "object" || result === null) return `${jobs[job].label} hoàn tất.`;
  const counts = result as Record<string, unknown>;
  if (job === "overdue") {
    const overdue = counts.overdueCount ?? counts.updatedCount;
    if (typeof overdue === "number") return `Đã đánh dấu quá hạn ${numberFormat.format(overdue)} kỳ.`;
  } else {
    const confirmed = counts.confirmed ?? counts.confirmedCount;
    if (typeof confirmed === "number") {
      const failed =
        typeof counts.failed === "number" ? ` · ${numberFormat.format(counts.failed)} thất bại` : "";
      return `Đã xác nhận ${numberFormat.format(confirmed)} giao dịch${failed}.`;
    }
  }
  return `${jobs[job].label} hoàn tất.`;
}

export function SystemOps() {
  const { data, failed, reload } = useOpsResource(adminApi.health, 30_000);
  const [running, setRunning] = useState<Job>();
  const [notice, setNotice] = useState<{ message: string; failed: boolean }>();

  async function runJob(job: Job) {
    setRunning(job);
    setNotice(undefined);
    try {
      const result = await jobs[job].run();
      setNotice({ message: summarizeJob(job, result), failed: false });
      reload();
    } catch {
      setNotice({ message: `Tác vụ “${jobs[job].label}” thất bại.`, failed: true });
    } finally {
      setRunning(undefined);
    }
  }

  const contractId = data?.stellar.contractId;
  const inFlight = data ? data.queue.pending + data.queue.submitted : 0;

  return (
    <OpsPage
      title="Hệ thống"
      description="Giám sát dịch vụ và chạy tác vụ nền. Dữ liệu tự làm mới mỗi 30 giây."
    >
      <ResourceMessage failed={failed} hasData={!!data} reload={reload} />
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink/70">
            <p>
              Kiểm tra lần cuối <Timestamp value={data.checkedAt} />
            </p>
            <button type="button" className={buttonClass} onClick={reload}>
              Làm mới
            </button>
          </div>
          <OpsEnter className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HealthCard
              title="Cơ sở dữ liệu"
              tone={data.database.ok ? "good" : "bad"}
              status={data.database.ok ? "Hoạt động" : "Gián đoạn"}
            >
              <Metric value={data.database.ok ? data.database.latencyMs : null} unit="ms" />
              <p className="text-xs text-ink/65">Độ trễ truy vấn</p>
            </HealthCard>
            <HealthCard
              title="Stellar RPC"
              tone={data.stellar.rpcOk ? "good" : "bad"}
              status={data.stellar.rpcOk ? "Hoạt động" : "Gián đoạn"}
            >
              <Metric value={data.stellar.latestLedger} />
              <p className="text-xs text-ink/65">Ledger mới nhất</p>
            </HealthCard>
            <HealthCard
              title="Contract"
              tone={data.stellar.contractOk ? "good" : contractId ? "bad" : "warn"}
              status={data.stellar.contractOk ? "Hoạt động" : contractId ? "Gián đoạn" : "Chưa có ID"}
            >
              {contractId ? (
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${encodeURIComponent(contractId)}`}
                  target="_blank"
                  rel="noreferrer"
                  title={contractId}
                  aria-label="Xem contract trên Stellar Expert (mở tab mới)"
                  className="inline-block max-w-full text-sm font-semibold text-primary-strong underline [overflow-wrap:anywhere]"
                >
                  {contractId.slice(0, 8)}…{contractId.slice(-6)} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <p className="text-sm text-ink/65">Chưa có mã contract.</p>
              )}
            </HealthCard>
            <WalletCard
              title="Ví nền tảng"
              balance={data.stellar.platformBalanceXlm}
              low={data.stellar.lowBalance}
            />
            <WalletCard
              title="Ví oracle"
              balance={data.stellar.oracleBalanceXlm}
              low={data.stellar.lowBalance}
            />
            <HealthCard
              title="Hàng đợi on-chain"
              tone={data.queue.failed ? "bad" : inFlight ? "warn" : "good"}
              status={data.queue.failed ? "Có lỗi" : inFlight ? "Đang xử lý" : "Ổn định"}
            >
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-ink/65">Đang chờ</dt>
                  <dd className="font-bold">
                    <AnimatedNumber value={data.queue.pending} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/65">Đã gửi</dt>
                  <dd className="font-bold">
                    <AnimatedNumber value={data.queue.submitted} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/65">Thất bại</dt>
                  <dd className="font-bold">
                    <AnimatedNumber value={data.queue.failed} />
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-ink/65">
                Chờ lâu nhất <AnimatedNumber value={data.queue.oldestPendingSeconds} />
                {data.queue.oldestPendingSeconds !== null && " giây"}
              </p>
            </HealthCard>
            {data.stellar.lowBalance && (
              <p
                role="status"
                className="rounded-xl bg-amber/15 px-4 py-3 text-sm font-medium text-amber-ink sm:col-span-2 lg:col-span-3"
              >
                Ít nhất một ví vận hành có số dư XLM testnet thấp.
              </p>
            )}
          </OpsEnter>
          <section className={`${cardClass} p-4 sm:p-5`} aria-labelledby="mode-heading">
            <h2 id="mode-heading" className="mb-3 font-bold">
              Chế độ vận hành
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink/65">Chế độ demo</dt>
                <dd className="font-semibold">{data.demoMode ? "Đang bật" : "Đang tắt"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/65">Chế độ thanh toán</dt>
                <dd className="font-semibold">{paymentModes[data.paymentMode] ?? "Chưa xác định"}</dd>
              </div>
            </dl>
          </section>
          <section className={`${cardClass} space-y-3 p-4 sm:p-5`} aria-labelledby="jobs-heading">
            <h2 id="jobs-heading" className="font-bold">
              Tác vụ nền
            </h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(jobs) as Job[]).map((job) => (
                <button
                  key={job}
                  type="button"
                  className={primaryButtonClass}
                  disabled={!!running}
                  onClick={() => void runJob(job)}
                >
                  {running === job ? "Đang chạy…" : jobs[job].label}
                </button>
              ))}
            </div>
            {notice && (
              <p
                role={notice.failed ? "alert" : "status"}
                className={`rounded-xl px-3 py-2 text-sm ${notice.failed ? tones.bad : tones.good}`}
              >
                {notice.message}
              </p>
            )}
          </section>
        </>
      )}
    </OpsPage>
  );
}
