"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Activity, RefreshCw } from "lucide-react";
import {
  AreaChart,
  BarChart,
  CHART_COLORS,
  ChartCard,
  DonutChart,
  Gauge,
  KpiCard,
  formatPercentVi,
  formatTimeSecondsVi,
  formatVndCompactVi,
  formatVndVi,
  trendPercent,
  usePrefersReducedMotion,
} from "@/components/admin/charts";
import type { AdminOverviewDto } from "@/domain/admin/dto";
import {
  CONTRACT_STATUS_LABELS,
  DEPOSIT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ContractStatus,
  type DepositStatus,
  type PaymentStatus,
} from "@/domain/states";
import { adminApi } from "@/lib/admin/api-client";

const CONTRACT_COLORS: Record<ContractStatus, string> = {
  ACTIVE: CHART_COLORS.primary,
  PENDING_CONFIRMATION: CHART_COLORS.amber,
  ENDED: "rgba(20, 33, 61, 0.45)",
  CANCELLED: CHART_COLORS.brick,
};

const DEPOSIT_COLORS: Record<DepositStatus, string> = {
  RECORDED: CHART_COLORS.primary,
  PENDING_REFUND: CHART_COLORS.amber,
  PENDING_DISPUTE: CHART_COLORS.brick,
  REFUNDED: CHART_COLORS.primaryStrong,
  DEDUCTED: "rgba(20, 33, 61, 0.55)",
  UNPAID: "rgba(20, 33, 61, 0.25)",
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  CONFIRMED: CHART_COLORS.primary,
  PENDING: CHART_COLORS.amber,
  UNDERPAID: "#d97706",
  OVERPAID: "#0d9488",
  FAILED: CHART_COLORS.brick,
  EXPIRED: "rgba(20, 33, 61, 0.3)",
};

export function OverviewDashboard() {
  const [data, setData] = useState<AdminOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasStaggered = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminApi.overview();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu tổng quan.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .overview()
      .then((res) => {
        if (!active) return;
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu tổng quan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Các khối xuất hiện so le khi tải lần đầu (chỉ animate transform + opacity)
  useEffect(() => {
    if (!data || hasStaggered.current || !rootRef.current) return;
    hasStaggered.current = true;
    if (reducedMotion) return;

    const blocks = rootRef.current.querySelectorAll("[data-stagger-block='true']");
    if (blocks.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        blocks,
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.055,
          ease: "power2.out",
          clearProps: "transform,opacity",
        },
      );
    }, rootRef);

    return () => ctx.revert();
  }, [data, reducedMotion]);

  const labels = useMemo(() => data?.series.newUsers.map((p) => p.date) ?? [], [data]);
  const newUsersVals = useMemo(() => data?.series.newUsers.map((p) => p.value) ?? [], [data]);
  const loginsVals = useMemo(() => data?.series.logins.map((p) => p.value) ?? [], [data]);
  const newContractsVals = useMemo(
    () => data?.series.newContracts.map((p) => p.value) ?? [],
    [data],
  );
  const paymentsVals = useMemo(
    () => data?.series.paymentsAmount.map((p) => p.value) ?? [],
    [data],
  );
  const onchainConfirmedVals = useMemo(
    () => data?.series.onchainConfirmed.map((p) => p.value) ?? [],
    [data],
  );
  const onchainFailedVals = useMemo(
    () => data?.series.onchainFailed.map((p) => p.value) ?? [],
    [data],
  );

  const contractDonut = useMemo(() => {
    if (!data) return [];
    return (Object.keys(CONTRACT_STATUS_LABELS) as ContractStatus[]).map((key) => ({
      id: key,
      label: CONTRACT_STATUS_LABELS[key],
      value: data.kpis.contracts.byStatus[key] ?? 0,
      color: CONTRACT_COLORS[key],
    }));
  }, [data]);

  const depositDonut = useMemo(() => {
    if (!data) return [];
    return (Object.keys(DEPOSIT_STATUS_LABELS) as DepositStatus[]).map((key) => ({
      id: key,
      label: DEPOSIT_STATUS_LABELS[key],
      value: data.kpis.deposits.byStatus[key] ?? 0,
      color: DEPOSIT_COLORS[key],
    }));
  }, [data]);

  const paymentDonut = useMemo(() => {
    if (!data) return [];
    return (Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((key) => ({
      id: key,
      label: PAYMENT_STATUS_LABELS[key],
      value: data.kpis.payments.byStatus[key] ?? 0,
      color: PAYMENT_COLORS[key],
    }));
  }, [data]);

  const openDisputes = data
    ? (data.kpis.disputes.byStatus.IN_PROGRESS ?? 0) +
      (data.kpis.disputes.byStatus.AWAITING_CONFIRMATION ?? 0)
    : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Tiêu đề trang đơn giản (Manager sẽ thay bằng AdminPageHeader khi gộp) */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">
            Bảng điều khiển quản trị
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Tổng quan hệ thống
          </h1>
          <p className="mt-1 text-sm text-ink/65">
            Theo dõi chỉ số vận hành 30 ngày gần nhất · Mọi số tiền hiển thị là dữ liệu mô phỏng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data ? (
            <span className="tabular text-xs text-ink/55">
              Cập nhật lúc {formatTimeSecondsVi(data.generatedAt)}
            </span>
          ) : null}
          <Link
            href="/admin/truc-tiep"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Trực tiếp</span>
          </Link>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-primary-strong disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{refreshing ? "Đang tải…" : "Làm mới"}</span>
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-brick/30 bg-brick/8 p-5 text-sm text-brick-ink"
        >
          <p className="font-semibold">Không thể tải số liệu tổng quan</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void load(false)}
            className="mt-3 rounded-full bg-brick px-4 py-1.5 text-xs font-semibold text-paper"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-6" aria-busy="true" aria-label="Đang tải dữ liệu tổng quan">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface/60"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface/60"
              />
            ))}
          </div>
        </div>
      ) : null}

      {data ? (
        <div ref={rootRef} className="space-y-6">
          {/* Hàng KPI chính */}
          <section
            aria-label="Chỉ số tổng quan"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <KpiCard
              title="Người dùng"
              value={data.kpis.users.total}
              deltaPercent={trendPercent(newUsersVals)}
              sparkline={newUsersVals}
              sparklineLabel="Xu hướng người dùng mới 30 ngày"
              subtitle={`${data.kpis.users.landlords} chủ nhà · ${data.kpis.users.tenants} người thuê · +${data.kpis.users.newLast7d} (7 ngày)`}
              tone="primary"
              className="[&]:min-w-0"
            />
            <KpiCard
              title="Hợp đồng"
              value={data.kpis.contracts.total}
              deltaPercent={trendPercent(newContractsVals)}
              sparkline={newContractsVals}
              sparklineLabel="Xu hướng hợp đồng mới 30 ngày"
              subtitle={`${data.kpis.contracts.byStatus.ACTIVE ?? 0} hiệu lực · ${data.kpis.contracts.byStatus.PENDING_CONFIRMATION ?? 0} chờ xác nhận`}
              tone="primary"
            />
            <KpiCard
              title="Cọc đang giữ (mô phỏng)"
              value={Number(data.kpis.deposits.heldAmount)}
              formatValue={formatVndCompactVi}
              deltaPercent={trendPercent(paymentsVals)}
              sparkline={paymentsVals}
              sparklineLabel="Xu hướng dòng tiền thanh toán mô phỏng 30 ngày"
              subtitle={`Mô phỏng · ${data.kpis.deposits.byStatus.RECORDED ?? 0} khoản đã ghi nhận`}
              tone="primary"
            />
            <KpiCard
              title="Kỳ thuê quá hạn"
              value={data.kpis.rent.byStatus.OVERDUE ?? 0}
              subtitle={`Mô phỏng ${formatVndVi(data.kpis.rent.overdueAmount)} cần theo dõi`}
              tone={(data.kpis.rent.byStatus.OVERDUE ?? 0) > 0 ? "amber" : "primary"}
            />
            <KpiCard
              title="Tranh chấp đang mở"
              value={openDisputes}
              subtitle={`${data.kpis.disputes.byStatus.IN_PROGRESS ?? 0} đang xử lý · ${data.kpis.disputes.byStatus.RESOLVED ?? 0} đã thống nhất`}
              tone={openDisputes > 0 ? "brick" : "neutral"}
            />
            <KpiCard
              title="Tỷ lệ on-chain thành công"
              value={data.kpis.onchain.successRate}
              formatValue={(v) => formatPercentVi(v, 1)}
              sparkline={onchainConfirmedVals}
              sparklineLabel="Xu hướng giao dịch on-chain xác nhận 30 ngày"
              subtitle={`${data.kpis.onchain.byStatus.CONFIRMED ?? 0} xác nhận · ${data.kpis.onchain.byStatus.FAILED ?? 0} lỗi (30 ngày)`}
              tone={data.kpis.onchain.successRate >= 0.9 ? "primary" : "amber"}
            />
          </section>

          {/* Biểu đồ xu hướng 30 ngày */}
          <section
            aria-label="Biểu đồ xu hướng 30 ngày"
            className="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Người dùng mới và lượt đăng nhập"
                subtitle="30 ngày gần nhất · so sánh tăng trưởng tài khoản và tần suất truy cập"
              >
                <AreaChart
                  labels={labels}
                  ariaLabel="Biểu đồ vùng người dùng mới và lượt đăng nhập 30 ngày gần nhất"
                  series={[
                    {
                      id: "logins",
                      label: "Lượt đăng nhập",
                      color: CHART_COLORS.primary,
                      values: loginsVals,
                    },
                    {
                      id: "newUsers",
                      label: "Người dùng mới",
                      color: CHART_COLORS.amber,
                      values: newUsersVals,
                    },
                  ]}
                />
              </ChartCard>
            </div>

            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Hợp đồng mới theo ngày"
                subtitle="30 ngày gần nhất · tổng số hợp đồng được khởi tạo mỗi ngày"
              >
                <BarChart
                  labels={labels}
                  ariaLabel="Biểu đồ cột hợp đồng mới 30 ngày gần nhất"
                  series={[
                    {
                      id: "newContracts",
                      label: "Hợp đồng mới",
                      color: CHART_COLORS.primary,
                      values: newContractsVals,
                    },
                  ]}
                />
              </ChartCard>
            </div>

            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Tiền thanh toán theo ngày (mô phỏng)"
                subtitle={`30 ngày gần nhất · đã thu mô phỏng ${formatVndVi(data.kpis.rent.collectedLast30d)}`}
              >
                <AreaChart
                  labels={labels}
                  ariaLabel="Biểu đồ vùng tiền thanh toán mô phỏng 30 ngày gần nhất"
                  formatY={formatVndCompactVi}
                  formatValue={(v) => `${formatVndVi(v)} (mô phỏng)`}
                  series={[
                    {
                      id: "paymentsAmount",
                      label: "Thanh toán (mô phỏng)",
                      color: CHART_COLORS.primaryStrong,
                      values: paymentsVals,
                    },
                  ]}
                />
              </ChartCard>
            </div>

            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Giao dịch on-chain theo ngày"
                subtitle="30 ngày gần nhất · so sánh giao dịch đã xác nhận và giao dịch lỗi"
              >
                <BarChart
                  labels={labels}
                  stacked
                  ariaLabel="Biểu đồ cột chồng giao dịch on-chain xác nhận và lỗi 30 ngày gần nhất"
                  series={[
                    {
                      id: "confirmed",
                      label: "Đã xác nhận",
                      color: CHART_COLORS.primary,
                      values: onchainConfirmedVals,
                    },
                    {
                      id: "failed",
                      label: "Lỗi",
                      color: CHART_COLORS.brick,
                      values: onchainFailedVals,
                    },
                  ]}
                />
              </ChartCard>
            </div>
          </section>

          {/* Phân bố trạng thái & Tỷ lệ thành công on-chain */}
          <section
            aria-label="Phân bố trạng thái và tỷ lệ on-chain"
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Trạng thái hợp đồng"
                subtitle="Phân bố toàn bộ hợp đồng hiện có trên hệ thống"
              >
                <DonutChart
                  items={contractDonut}
                  centerLabel="Hợp đồng"
                  ariaLabel="Biểu đồ tròn phân bố trạng thái hợp đồng"
                />
              </ChartCard>
            </div>

            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Trạng thái tiền cọc (mô phỏng)"
                subtitle="Trạng thái ghi nhận và hoàn trả cọc giữa hai bên"
              >
                <DonutChart
                  items={depositDonut}
                  centerLabel="Khoản cọc"
                  ariaLabel="Biểu đồ tròn phân bố trạng thái tiền cọc mô phỏng"
                />
              </ChartCard>
            </div>

            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Trạng thái thanh toán (mô phỏng)"
                subtitle={`Tỷ lệ giao dịch mô phỏng: ${formatPercentVi(data.kpis.payments.simulatedShare, 0)}`}
              >
                <DonutChart
                  items={paymentDonut}
                  centerLabel="Giao dịch"
                  ariaLabel="Biểu đồ tròn phân bố trạng thái thanh toán mô phỏng"
                />
              </ChartCard>
            </div>

            <div data-stagger-block="true" className="min-w-0">
              <ChartCard
                title="Tỷ lệ thành công on-chain"
                subtitle="Hiệu quả ghi nhận chứng cứ trong 30 ngày gần nhất"
              >
                <div className="flex h-full flex-col items-center justify-center py-2">
                  <Gauge
                    value={data.kpis.onchain.successRate}
                    label="Xác nhận thành công"
                    sublabel={`${data.kpis.onchain.byStatus.CONFIRMED ?? 0} xác nhận · ${data.kpis.onchain.byStatus.PENDING ?? 0} chờ gửi · ${data.kpis.onchain.byStatus.FAILED ?? 0} lỗi`}
                    ariaLabel="Đồng hồ đo tỷ lệ thành công giao dịch on-chain 30 ngày gần nhất"
                  />
                </div>
              </ChartCard>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
