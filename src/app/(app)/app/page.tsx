"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { PasskeySetup } from "@/components/app/passkey-setup";
import { apiClient } from "@/components/app/api-client";
import { LoadingSkeleton, EmptyState, ErrorState } from "@/components/app/ui-state";
import { StatusBadge, MoneyAmount, resolvePrimaryContractBadge } from "@/components/shared";
import { formatDate } from "@/components/app/date-format";
import type { ContractSummaryDto } from "@/domain/dto";

function stripDemoSuffix(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  return name.replace(/\s*\([^)]*\)\s*/g, "").trim() || fallback;
}

function extractRoomKey(roomLabel: string, fallbackId: string): string {
  const match = roomLabel.match(/\d+/);
  return match ? match[0] : fallbackId;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, isLoading: sessionLoading } = useSession();
  const [contracts, setContracts] = useState<ContractSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "DISPUTE">("ALL");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getContracts(role === "TENANT" ? "TENANT" : "LANDLORD");
      setContracts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getContracts(role === "TENANT" ? "TENANT" : "LANDLORD")
      .then((data) => {
        if (!ignore) {
          setContracts(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách hợp đồng");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [role]);

  const filteredContracts = contracts.filter((c) => {
    if (filter === "ACTIVE" && c.status !== "ACTIVE") return false;
    if (filter === "PENDING" && c.status !== "PENDING_CONFIRMATION") return false;
    if (
      filter === "DISPUTE" &&
      c.depositStatus !== "PENDING_DISPUTE" &&
      c.disputeStatus === "NONE"
    ) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.roomLabel.toLowerCase().includes(q) ||
        Boolean(c.landlordName?.toLowerCase().includes(q)) ||
        Boolean(c.tenantName?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // 3 overview numbers
  const activeCount = contracts.filter((c) => c.status === "ACTIVE").length;

  const heldDepositTotal = contracts.reduce((sum, c) => {
    if (
      c.depositStatus === "RECORDED" ||
      c.depositStatus === "PENDING_REFUND" ||
      c.depositStatus === "PENDING_DISPUTE"
    ) {
      return sum + BigInt(c.depositAmount || "0");
    }
    return sum;
  }, BigInt(0));

  const attentionCount = contracts.filter(
    (c) =>
      c.status === "PENDING_CONFIRMATION" ||
      (c.status === "ACTIVE" && c.depositStatus === "UNPAID") ||
      c.depositStatus === "PENDING_DISPUTE" ||
      (c.disputeStatus !== "NONE" && c.disputeStatus !== "RESOLVED") ||
      (c.status === "ACTIVE" && c.journeyStep === "RENT"),
  ).length;

  // Compact action items
  const actionItems: { id: string; text: string; href: string }[] = [];
  contracts.forEach((c) => {
    if (c.status === "PENDING_CONFIRMATION" && role === "TENANT") {
      actionItems.push({
        id: `${c.id}-sign`,
        text: `${c.roomLabel} đang chờ bạn ký xác nhận`,
        href: `/app/hop-dong/${c.id}#tong-quan`,
      });
    } else if (c.status === "ACTIVE" && c.depositStatus === "UNPAID" && role === "TENANT") {
      actionItems.push({
        id: `${c.id}-deposit`,
        text: `${c.roomLabel} chưa nộp tiền cọc bảo chứng`,
        href: `/app/hop-dong/${c.id}#tien-coc`,
      });
    } else if (c.depositStatus === "PENDING_DISPUTE") {
      actionItems.push({
        id: `${c.id}-dispute`,
        text: `${c.roomLabel} có tranh chấp cần hai bên thống nhất`,
        href: `/app/hop-dong/${c.id}#hoan-coc`,
      });
    }
  });

  const cleanUserName = stripDemoSuffix(user?.fullName, "bạn");

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <AppNavbar />
        <main className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-8 space-y-6">
          <LoadingSkeleton lines={4} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 min-w-0">
        {/* 1. Short Greeting + Landlord Primary Action */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Chào {cleanUserName}
            </h1>
            <p className="text-sm text-ink/65">
              {role === "LANDLORD"
                ? "Quản lý hợp đồng thuê, trạng thái tiền cọc và kỳ thu tiền."
                : "Theo dõi hợp đồng thuê, tiền cọc bảo chứng và lịch thanh toán."}
            </p>
          </div>

          {role === "LANDLORD" && (
            <Link
              href="/app/hop-dong/moi"
              data-tour="create-contract"
              className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition-colors hover:bg-ink/90 self-start sm:self-auto shrink-0"
            >
              Tạo hợp đồng
            </Link>
          )}
        </section>

        {/* 2. Row of 3 Overview Numbers */}
        <section
          data-tour="dashboard-stats"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
        >
          <div className="rounded-3xl border border-line bg-paper p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-ink/60 block">
              Hợp đồng đang hiệu lực
            </span>
            <div className="tabular text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              {activeCount}
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-paper p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-ink/60 block">
              Cọc đang giữ (mô phỏng)
            </span>
            <MoneyAmount value={heldDepositTotal.toString()} size="lg" />
          </div>

          <div className="rounded-3xl border border-line bg-paper p-5 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-ink/60 block">
              Khoản đến hạn hoặc quá hạn
            </span>
            <div
              className={`tabular text-2xl sm:text-3xl font-extrabold tracking-tight ${
                attentionCount > 0 ? "text-amber-ink" : "text-ink"
              }`}
            >
              {attentionCount}
            </div>
          </div>
        </section>

        {/* 3. Compact Notifications / Pending Actions + Passkey */}
        {(actionItems.length > 0 || process.env.NEXT_PUBLIC_UI_MOCK !== "true") && (
          <section className="space-y-3">
            {actionItems.length > 0 && (
              <div className="rounded-3xl border border-amber/35 bg-amber/10 p-4 sm:p-5 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-ink">
                  Cần xử lý ({actionItems.length})
                </div>
                <div className="divide-y divide-amber/20">
                  {actionItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-xs sm:text-sm font-semibold text-ink hover:text-primary transition-colors"
                    >
                      <span>{item.text}</span>
                      <span className="text-xs font-bold text-primary shrink-0">Mở →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {process.env.NEXT_PUBLIC_UI_MOCK !== "true" && <PasskeySetup />}
          </section>
        )}

        {/* 4. Contract List */}
        <section data-tour="contract-list" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-ink">
              Hợp đồng ({filteredContracts.length})
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <div
                className="flex items-center gap-0.5 rounded-full border border-line bg-surface/65 p-1 text-xs font-semibold overflow-x-auto max-w-full whitespace-nowrap"
                data-lenis-prevent
              >
                {(
                  [
                    { key: "ALL", label: "Tất cả" },
                    { key: "ACTIVE", label: "Đang hiệu lực" },
                    { key: "PENDING", label: "Chờ xác nhận" },
                    { key: "DISPUTE", label: "Tranh chấp" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={`rounded-full px-3 py-1.5 transition-colors cursor-pointer ${
                      filter === tab.key
                        ? "bg-paper font-bold text-ink shadow-xs"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Tìm phòng hoặc tên…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-48 rounded-full border border-line bg-paper px-4 py-1.5 text-xs text-ink focus:outline-primary"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <LoadingSkeleton lines={3} />
              <LoadingSkeleton lines={3} />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={loadData} />
          ) : filteredContracts.length === 0 ? (
            <EmptyState
              title="Chưa có hợp đồng phù hợp"
              description="Thử đổi bộ lọc hoặc tạo hợp đồng thuê mới."
              actionLabel={role === "LANDLORD" ? "Tạo hợp đồng" : undefined}
              onAction={role === "LANDLORD" ? () => router.push("/app/hop-dong/moi") : undefined}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredContracts.map((c) => {
                const badge = resolvePrimaryContractBadge(c);
                const roomKey = extractRoomKey(c.roomLabel, c.id);
                const counterpartLabel =
                  role === "LANDLORD"
                    ? `Người thuê: ${stripDemoSuffix(c.tenantName, "Trần Thị Bình")}`
                    : `Chủ nhà: ${stripDemoSuffix(c.landlordName, "Nguyễn Văn An")}`;

                return (
                  <div
                    key={c.id}
                    data-tour="contract-card"
                    data-tour-key={roomKey}
                    className="flex flex-col justify-between rounded-[2rem] border border-line bg-paper p-6 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft space-y-5"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2.5">
                        <h3 className="text-base sm:text-lg font-extrabold text-ink leading-snug">
                          {c.roomLabel}
                        </h3>
                        <StatusBadge kind={badge.kind} status={badge.status} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1.5">
                          <MoneyAmount value={c.rentAmount} size="lg" />
                          <span className="text-xs font-medium text-ink/55">/ tháng</span>
                        </div>
                        <p className="text-xs text-ink/65">
                          Cọc: <MoneyAmount value={c.depositAmount} size="sm" /> · {counterpartLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-4 text-xs">
                      <span className="text-ink/55">
                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                      </span>
                      <Link
                        href={`/app/hop-dong/${c.id}`}
                        data-tour="contract-open"
                        className="rounded-full bg-surface px-4 py-2 font-bold text-ink transition-colors hover:bg-ink hover:text-paper shrink-0"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
