"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { apiClient } from "@/components/app/api-client";
import { LoadingSkeleton, EmptyState, ErrorState } from "@/components/app/ui-state";
import { JourneyStepper, StatusBadge, MoneyAmount, MockBadge } from "@/components/shared";
import type { ContractSummaryDto } from "@/domain/dto";

export default function DashboardPage() {
  const router = useRouter();
  const { user, role } = useSession();
  const [contracts, setContracts] = useState<ContractSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "DISPUTE" | "ENDED">("ALL");
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

  // Filtered list
  const filteredContracts = contracts.filter((c) => {
    // Filter status
    if (filter === "ACTIVE" && c.status !== "ACTIVE") return false;
    if (filter === "PENDING" && c.status !== "PENDING_CONFIRMATION") return false;
    if (filter === "DISPUTE" && c.depositStatus !== "PENDING_DISPUTE" && c.disputeStatus === "NONE") return false;
    if (filter === "ENDED" && c.status !== "ENDED") return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchRoom = c.roomLabel.toLowerCase().includes(q);
      const matchLandlord = c.landlordName?.toLowerCase().includes(q);
      const matchTenant = c.tenantName?.toLowerCase().includes(q);
      return matchRoom || matchLandlord || matchTenant;
    }
    return true;
  });

  // Calculate To-Do / Action items
  const actionItems: { contract: ContractSummaryDto; text: string; deepLink: string }[] = [];
  contracts.forEach((c) => {
    if (c.status === "PENDING_CONFIRMATION") {
      if (role === "TENANT") {
        actionItems.push({
          contract: c,
          text: `Cần xem xét & Ký xác nhận hợp đồng cho ${c.roomLabel}`,
          deepLink: `/app/hop-dong/${c.id}#tong-quan`,
        });
      }
    }
    if (c.status === "ACTIVE" && c.depositStatus === "UNPAID" && role === "TENANT") {
      actionItems.push({
        contract: c,
        text: `Cần nạp tiền cọc bảo chứng cho ${c.roomLabel}`,
        deepLink: `/app/hop-dong/${c.id}#tien-coc`,
      });
    }
    if (c.depositStatus === "PENDING_DISPUTE") {
      actionItems.push({
        contract: c,
        text: `Hợp đồng ${c.roomLabel} đang có tranh chấp, cần hai bên thống nhất`,
        deepLink: `/app/hop-dong/${c.id}#hoan-coc`,
      });
    }
  });

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <section className="p-6 sm:p-8 rounded-panel bg-surface/60 border border-line flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                Xin chào, {user?.fullName || "Người dùng"}!
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                {role === "LANDLORD" ? "Chủ nhà" : role === "ADMIN_DEMO" ? "Admin Demo" : "Người thuê"}
              </span>
            </div>
            <p className="text-sm sm:text-base text-ink/70">
              {role === "LANDLORD"
                ? "Quản lý hợp đồng cho thuê, theo dõi bảo chứng tiền cọc và lịch thu tiền thuê tự động."
                : "Theo dõi trạng thái tiền cọc bảo chứng, nghĩa vụ thanh toán và ký hợp đồng bảo mật."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {role === "LANDLORD" && (
              <Link
                href="/app/hop-dong/moi"
                className="px-5 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-all shadow-xs cursor-pointer text-sm whitespace-nowrap"
              >
                + Tạo hợp đồng mới
              </Link>
            )}
            <Link
              href="/bang-chung"
              className="px-4 py-2.5 rounded-xl bg-paper border border-line text-ink font-semibold hover:bg-surface transition-all text-sm whitespace-nowrap"
            >
              Xem sổ cái On-chain
            </Link>
          </div>
        </section>

        {/* To-Do / Action Items Callout */}
        {actionItems.length > 0 && (
          <section aria-labelledby="todo-heading" className="p-5 sm:p-6 rounded-card bg-amber/15 border border-amber/40 space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="todo-heading" className="text-base font-bold text-amber-ink flex items-center gap-2">
                <span>⚠️</span> Việc cần làm ngay ({actionItems.length})
              </h2>
              <MockBadge label="HÀNH ĐỘNG" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {actionItems.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.deepLink}
                  className="p-3 bg-paper rounded-xl border border-line hover:border-amber/60 flex items-center justify-between gap-3 transition-colors group cursor-pointer shadow-xs"
                >
                  <span className="text-xs sm:text-sm font-semibold text-ink group-hover:text-primary">
                    {item.text}
                  </span>
                  <span className="text-xs text-primary font-bold whitespace-nowrap">Xử lý ➔</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Contract list section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold text-ink tracking-tight">
              Danh sách hợp đồng ({filteredContracts.length})
            </h2>

            {/* Filters and search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-surface p-1 border border-line text-xs font-semibold">
                <button
                  onClick={() => setFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "ALL" ? "bg-paper text-ink shadow-xs" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilter("ACTIVE")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "ACTIVE" ? "bg-paper text-primary font-bold shadow-xs" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Hiệu lực
                </button>
                <button
                  onClick={() => setFilter("PENDING")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "PENDING" ? "bg-paper text-amber-ink font-bold shadow-xs" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Chờ ký
                </button>
                <button
                  onClick={() => setFilter("DISPUTE")}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    filter === "DISPUTE" ? "bg-paper text-brick font-bold shadow-xs" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Tranh chấp
                </button>
              </div>

              <input
                type="text"
                placeholder="Tìm kiếm phòng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-line bg-paper text-xs text-ink focus:outline-primary w-40 sm:w-48"
              />
            </div>
          </div>

          {/* List Content */}
          {loading ? (
            <div className="space-y-4">
              <LoadingSkeleton lines={3} />
              <LoadingSkeleton lines={3} />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={loadData} />
          ) : filteredContracts.length === 0 ? (
            <EmptyState
              title="Không tìm thấy hợp đồng nào"
              description="Bạn chưa có hợp đồng nào trong danh mục này hoặc từ khóa tìm kiếm không khớp."
              actionLabel={role === "LANDLORD" ? "+ Tạo hợp đồng đầu tiên" : undefined}
              onAction={role === "LANDLORD" ? () => router.push("/app/hop-dong/moi") : undefined}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContracts.map((c) => (
                <div
                  key={c.id}
                  className="bg-paper rounded-card border border-line p-5 sm:p-6 shadow-xs hover:shadow-soft transition-all flex flex-col justify-between space-y-5"
                >
                  {/* Card top */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-base sm:text-lg text-ink line-clamp-1">
                        {c.roomLabel}
                      </h3>
                      <StatusBadge kind="contract" status={c.status} />
                    </div>

                    <div className="text-xs text-ink/70 space-y-1">
                      <div>
                        Chủ nhà: <strong>{c.landlordName || "Nguyễn Văn An"}</strong>
                      </div>
                      <div>
                        Người thuê: <strong>{c.tenantName || "Trần Thị Bình"}</strong>
                      </div>
                    </div>

                    {/* Stepper */}
                    <JourneyStepper current={c.journeyStep} compact />

                    {/* Financial summary */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface/50 border border-line text-xs">
                      <div>
                        <span className="text-ink/60 block mb-0.5">Giá thuê:</span>
                        <MoneyAmount value={c.rentAmount} size="sm" />
                      </div>
                      <div>
                        <span className="text-ink/60 block mb-0.5">Tiền cọc:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <MoneyAmount value={c.depositAmount} size="sm" />
                          <StatusBadge kind="deposit" status={c.depositStatus} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                    <span className="text-ink/50">Hạn: {c.startDate} → {c.endDate}</span>
                    <Link
                      href={`/app/hop-dong/${c.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary hover:text-paper transition-colors"
                    >
                      Xem chi tiết ➔
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
