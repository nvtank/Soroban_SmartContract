"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, Pause, Play } from "lucide-react";
import {
  CHART_COLORS,
  ChartCard,
  LiveLineChart,
  formatNumberVi,
  formatTimeSecondsVi,
  usePrefersReducedMotion,
} from "@/components/admin/charts";
import type { AdminEvent, AdminEventAction, AdminLiveDto } from "@/domain/admin/dto";
import { adminApi } from "@/lib/admin/api-client";

const POLL_INTERVAL_MS = 5000;
const MAX_EVENTS = 50;

type EventFilter = "ALL" | "AUTH" | "CONTRACT" | "PAYMENT" | "DISPUTE" | "ONCHAIN" | "SYSTEM";

const FILTER_OPTIONS: { id: EventFilter; label: string }[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "AUTH", label: "Đăng nhập" },
  { id: "CONTRACT", label: "Hợp đồng" },
  { id: "PAYMENT", label: "Thanh toán (mô phỏng)" },
  { id: "DISPUTE", label: "Tranh chấp & cọc" },
  { id: "ONCHAIN", label: "On-chain" },
  { id: "SYSTEM", label: "Hệ thống" },
];

const ACTION_BADGE: Partial<Record<AdminEventAction, { label: string; cls: string }>> = {
  LOGIN: { label: "Đăng nhập", cls: "bg-primary/12 text-primary-strong" },
  LOGOUT: { label: "Đăng xuất", cls: "bg-surface text-ink/70" },
  CONTRACT_CREATED: { label: "Tạo hợp đồng", cls: "bg-primary/12 text-primary-strong" },
  CONTRACT_CONFIRMED: { label: "Xác nhận HĐ", cls: "bg-primary/15 text-primary-strong" },
  PAYMENT_CREATED: { label: "Tạo thanh toán", cls: "bg-amber/20 text-amber-ink" },
  PAYMENT_SETTLED: { label: "Thanh toán xong", cls: "bg-primary/15 text-primary-strong" },
  REFUND_REQUESTED: { label: "Yêu cầu hoàn cọc", cls: "bg-amber/20 text-amber-ink" },
  REFUND_APPROVED: { label: "Duyệt hoàn cọc", cls: "bg-primary/15 text-primary-strong" },
  DEDUCTION_PROPOSED: { label: "Đề xuất khấu trừ", cls: "bg-amber/20 text-amber-ink" },
  DEDUCTION_RESPONDED: { label: "Phản hồi khấu trừ", cls: "bg-amber/20 text-amber-ink" },
  DISPUTE_OPENED: { label: "Mở tranh chấp", cls: "bg-brick/15 text-brick-ink" },
  DISPUTE_RESOLVED: { label: "Thống nhất tranh chấp", cls: "bg-primary/15 text-primary-strong" },
  DUE_EXTENDED: { label: "Gia hạn kỳ", cls: "bg-amber/20 text-amber-ink" },
  ONCHAIN_CONFIRMED: { label: "On-chain xác nhận", cls: "bg-primary/15 text-primary-strong" },
  ONCHAIN_FAILED: { label: "On-chain lỗi", cls: "bg-brick/15 text-brick-ink" },
  RECOVERY_REQUESTED: { label: "Yêu cầu khôi phục", cls: "bg-amber/20 text-amber-ink" },
  RECOVERY_APPROVED: { label: "Duyệt khôi phục", cls: "bg-primary/15 text-primary-strong" },
  ADMIN_ACTION: { label: "Quản trị", cls: "bg-surface text-ink" },
  OTHER: { label: "Khác", cls: "bg-surface text-ink/70" },
};

function matchesFilter(action: AdminEventAction, filter: EventFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "AUTH") return action === "LOGIN" || action === "LOGOUT";
  if (filter === "CONTRACT") {
    return action === "CONTRACT_CREATED" || action === "CONTRACT_CONFIRMED" || action === "DUE_EXTENDED";
  }
  if (filter === "PAYMENT") return action === "PAYMENT_CREATED" || action === "PAYMENT_SETTLED";
  if (filter === "DISPUTE") {
    return (
      action === "DISPUTE_OPENED" ||
      action === "DISPUTE_RESOLVED" ||
      action === "REFUND_REQUESTED" ||
      action === "REFUND_APPROVED" ||
      action === "DEDUCTION_PROPOSED" ||
      action === "DEDUCTION_RESPONDED"
    );
  }
  if (filter === "ONCHAIN") return action === "ONCHAIN_CONFIRMED" || action === "ONCHAIN_FAILED";
  return action === "RECOVERY_REQUESTED" || action === "RECOVERY_APPROVED" || action === "ADMIN_ACTION" || action === "OTHER";
}

function roleLabel(role: AdminEvent["actorRole"]): string {
  if (role === "LANDLORD") return "Chủ nhà";
  if (role === "TENANT") return "Người thuê";
  if (role === "ADMIN_DEMO") return "Quản trị";
  return "Hệ thống";
}

/** Sự kiện trong hôm nay chỉ hiện giờ; sự kiện ngày khác hiện kèm ngày để không trông như bị đảo thứ tự. */
function eventTimeLabel(at: string): string {
  const d = new Date(at);
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return formatTimeSecondsVi(at);
  const day = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time}`;
}

export function LiveDashboard() {
  const [live, setLive] = useState<AdminLiveDto | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<EventFilter>("ALL");
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayActive, setDisplayActive] = useState(0);

  const reducedMotion = usePrefersReducedMotion();
  const sinceRef = useRef<string | undefined>(undefined);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const prevActiveRef = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inFlightRef = useRef(false);

  const pollOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await adminApi.live(sinceRef.current);
      setError(null);
      setLive(res);

      // Cập nhật mốc since bằng thời điểm mới nhất đã nhận
      const newestAt = res.events[0]?.at ?? res.now;
      if (!sinceRef.current || newestAt > sinceRef.current) {
        sinceRef.current = newestAt;
      }

      if (res.events.length > 0) {
        const incomingNew: AdminEvent[] = [];
        for (const ev of res.events) {
          if (!seenIdsRef.current.has(ev.id)) {
            seenIdsRef.current.add(ev.id);
            incomingNew.push(ev);
          }
        }

        // Giữ bộ nhớ seenIdsRef gọn
        if (seenIdsRef.current.size > 400) {
          const trimmed = Array.from(seenIdsRef.current).slice(-200);
          seenIdsRef.current = new Set(trimmed);
        }

        if (incomingNew.length > 0) {
          const isInitial = seenIdsRef.current.size === incomingNew.length;
          setEvents((prev) => [...incomingNew, ...prev].slice(0, MAX_EVENTS));
          if (!isInitial) {
            setFreshIds(new Set(incomingNew.map((e) => e.id)));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật dữ liệu trực tiếp.");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Theo dõi trạng thái hiển thị của tab trình duyệt
  useEffect(() => {
    const syncVisibility = () => {
      const hidden = document.hidden;
      setTabHidden(hidden);
      if (!hidden && !paused) {
        void pollOnce();
      }
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [paused, pollOnce]);

  // Chu kỳ hỏi lại mỗi 5 giây, dừng khi tạm dừng hoặc tab ẩn
  useEffect(() => {
    if (paused || tabHidden) return;
    const immediate = window.setTimeout(() => {
      void pollOnce();
    }, 0);
    const timer = window.setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [paused, tabHidden, pollOnce]);

  // Đếm mượt số người dùng đang hoạt động
  useEffect(() => {
    const target = live?.activeUsers ?? 0;
    const from = prevActiveRef.current;
    prevActiveRef.current = target;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setDisplayActive(target));
      return () => cancelAnimationFrame(frame);
    }

    const proxy = { n: from };
    const tween = gsap.to(proxy, {
      n: target,
      duration: 0.65,
      ease: "power2.out",
      onUpdate: () => setDisplayActive(Math.round(proxy.n)),
    });
    return () => {
      tween.kill();
    };
  }, [live?.activeUsers, reducedMotion]);

  // Sự kiện mới trượt vào từ trên và nhấp nháy viền nhẹ
  useEffect(() => {
    if (freshIds.size === 0 || !listRef.current) return;
    if (reducedMotion) return;

    const nodes = Array.from(
      listRef.current.querySelectorAll<HTMLLIElement>("li[data-fresh='true']"),
    );
    if (nodes.length === 0) return;

    const tween = gsap.fromTo(
      nodes,
      { y: -14, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.42,
        stagger: 0.05,
        ease: "power2.out",
        clearProps: "transform,opacity",
      },
    );

    const clearTimer = window.setTimeout(() => {
      setFreshIds(new Set());
    }, 1800);

    return () => {
      tween.kill();
      window.clearTimeout(clearTimer);
    };
  }, [freshIds, reducedMotion]);

  const filteredEvents = useMemo(
    () => events.filter((e) => matchesFilter(e.action, filter)),
    [events, filter],
  );

  const isRunning = !paused && !tabHidden;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Tiêu đề trang đơn giản */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink/65 hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tổng quan</span>
            </Link>
            <span className="text-xs text-ink/35">/</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-strong">
              Trực tiếp
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Theo dõi trực tiếp
          </h1>
          <p className="mt-1 text-sm text-ink/65">
            Tự động cập nhật mỗi 5 giây khi tab đang mở · Tiền hiển thị trong sự kiện là mô phỏng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            role="status"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              isRunning
                ? "border-primary/30 bg-primary/10 text-primary-strong"
                : "border-line bg-surface text-ink/70"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                isRunning ? "bg-primary motion-safe:animate-pulse" : "bg-ink/40"
              }`}
            />
            <span>
              {paused
                ? "Đã tạm dừng"
                : tabHidden
                  ? "Tạm dừng (tab ẩn)"
                  : live
                    ? `Đang cập nhật · ${formatTimeSecondsVi(live.now)}`
                    : "Đang kết nối…"}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            {paused ? (
              <>
                <Play className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Tiếp tục</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 text-ink/75" aria-hidden="true" />
                <span>Tạm dừng</span>
              </>
            )}
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-[var(--radius-card)] border border-brick/30 bg-brick/8 px-4 py-3 text-sm text-brick-ink"
        >
          {error}
        </div>
      ) : null}

      {/* Hàng nổi bật: Số đang hoạt động + Hàng đợi on-chain */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="flex min-w-0 flex-col justify-between rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-[0_12px_32px_-24px_rgb(20_33_61/0.22)] lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink/70">Người dùng đang hoạt động</h2>
            <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary-strong">
              5 phút gần nhất
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span
              data-testid="live-active-users"
              className="tabular text-5xl font-bold tracking-tight text-ink sm:text-6xl"
            >
              {formatNumberVi(displayActive)}
            </span>
            <span className="text-sm text-ink/65">người dùng có thao tác gần đây</span>
          </div>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-[0_12px_32px_-24px_rgb(20_33_61/0.22)]">
          <div>
            <h2 className="text-sm font-medium text-ink/70">Hàng đợi on-chain</h2>
            <p className="mt-0.5 text-xs text-ink/55">Trạng thái ghi nhận chứng cứ hiện tại</p>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface/75 px-3 py-2.5 text-center">
              <dt className="text-[11px] font-medium text-ink/65">Chờ gửi</dt>
              <dd className="tabular mt-0.5 text-xl font-bold text-ink">
                {formatNumberVi(live?.queue.pending ?? 0)}
              </dd>
            </div>
            <div className="rounded-2xl bg-amber/15 px-3 py-2.5 text-center">
              <dt className="text-[11px] font-medium text-amber-ink">Đang gửi</dt>
              <dd className="tabular mt-0.5 text-xl font-bold text-amber-ink">
                {formatNumberVi(live?.queue.submitted ?? 0)}
              </dd>
            </div>
            <div className="rounded-2xl bg-brick/12 px-3 py-2.5 text-center">
              <dt className="text-[11px] font-medium text-brick-ink">Lỗi</dt>
              <dd className="tabular mt-0.5 text-xl font-bold text-brick-ink">
                {formatNumberVi(live?.queue.failed ?? 0)}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      {/* Hai biểu đồ trực tiếp 60 phút */}
      <section
        aria-label="Biểu đồ trực tiếp 60 phút"
        className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2"
      >
        <ChartCard
          title="Người dùng hoạt động theo phút"
          subtitle="60 phút gần nhất · trượt tự động khi có mốc mới"
        >
          <LiveLineChart
            points={live?.activeSeries ?? []}
            color={CHART_COLORS.primary}
            valueLabel="Đang hoạt động"
            unitSuffix="người"
            ariaLabel="Biểu đồ đường trực tiếp số người dùng hoạt động theo phút trong 60 phút gần nhất"
          />
        </ChartCard>

        <ChartCard
          title="Sự kiện hệ thống theo phút"
          subtitle="60 phút gần nhất · đăng nhập, hợp đồng, thanh toán mô phỏng và on-chain"
        >
          <LiveLineChart
            points={live?.eventSeries ?? []}
            color={CHART_COLORS.amber}
            valueLabel="Sự kiện"
            unitSuffix="sự kiện"
            ariaLabel="Biểu đồ đường trực tiếp số sự kiện theo phút trong 60 phút gần nhất"
          />
        </ChartCard>
      </section>

      {/* Dòng sự kiện */}
      <ChartCard
        title="Dòng sự kiện trực tiếp"
        subtitle={`Hiển thị tối đa ${MAX_EVENTS} sự kiện gần nhất · bấm tên người dùng để xem hồ sơ`}
        action={
          <span className="tabular rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink/70">
            {filteredEvents.length} / {events.length} sự kiện
          </span>
        }
      >
        {/* Bộ lọc theo loại sự kiện */}
        <div
          role="tablist"
          aria-label="Lọc sự kiện theo loại"
          className="mb-4 flex flex-wrap gap-1.5"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(opt.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-ink text-paper"
                    : "border border-line bg-paper text-ink/75 hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {filteredEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-ink/55">
            Chưa có sự kiện nào khớp bộ lọc hiện tại.
          </p>
        ) : (
          <ul
            ref={listRef}
            data-testid="live-event-stream"
            className="space-y-2"
          >
            {filteredEvents.map((ev) => {
              const badge = ACTION_BADGE[ev.action] ?? {
                label: ev.action,
                cls: "bg-surface text-ink/70",
              };
              const isFresh = freshIds.has(ev.id);
              return (
                <li
                  key={ev.id}
                  data-event-id={ev.id}
                  data-fresh={isFresh ? "true" : "false"}
                  className={`flex flex-col gap-1.5 rounded-2xl border px-4 py-3 text-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    isFresh
                      ? "border-primary/60 bg-primary/6"
                      : "border-line bg-paper/70 hover:bg-surface/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>

                      {ev.actorId && ev.actorLabel ? (
                        <Link
                          href={`/admin/nguoi-dung/${ev.actorId}`}
                          className="truncate font-semibold text-ink underline decoration-primary/40 underline-offset-2 hover:text-primary-strong"
                        >
                          {ev.actorLabel}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink/75">
                          {ev.actorLabel ?? "Hệ thống"}
                        </span>
                      )}

                      <span className="text-xs text-ink/50">· {roleLabel(ev.actorRole)}</span>
                    </div>

                    <p className="mt-1 text-sm text-ink/80">{ev.summary}</p>
                  </div>

                  <time
                    dateTime={ev.at}
                    className="tabular shrink-0 text-xs font-medium text-ink/55 sm:text-right"
                  >
                    {eventTimeLabel(ev.at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
