"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/app/app-navbar";
import { apiClient } from "@/components/app/api-client";
import { LoadingSkeleton, EmptyState, ErrorState } from "@/components/app/ui-state";
import { OnchainProofChip, MockBadge } from "@/components/shared";
import { formatDateTime } from "@/components/app/date-format";
import type { OnchainTxDto } from "@/domain/dto";

export default function PublicProofPage() {
  const [txs, setTxs] = useState<OnchainTxDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("ALL");

  const loadTxs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiClient.getOnchainTxs();
      setTxs(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách giao dịch on-chain");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getOnchainTxs()
      .then((list) => {
        if (!ignore) {
          setTxs(list);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách giao dịch on-chain");
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const filtered = txs.filter((t) => {
    if (filterAction !== "ALL" && t.action !== filterAction) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = t.contractId.toLowerCase().includes(q);
      const matchHash = t.txHash?.toLowerCase().includes(q);
      const matchAction = t.action.toLowerCase().includes(q);
      const matchPayload = t.payloadHash.toLowerCase().includes(q);
      return matchId || matchHash || matchAction || matchPayload;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2 text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Sổ cái Bằng chứng Minh bạch On-chain
            </h1>
            <MockBadge label="STELLAR TESTNET" />
          </div>
          <p className="text-xs sm:text-sm text-ink/70">
            Toàn bộ lịch sử cam kết tiền cọc, thu tiền thuê và xử lý tranh chấp được bảo chứng bất biến trên sổ cái phân tán Stellar Testnet qua Smart Contract Soroban.
          </p>
        </div>

        {/* Non-PII Banner */}
        <section className="p-4 sm:p-5 rounded-panel bg-primary/10 border border-primary/20 space-y-2 shadow-xs">
          <div className="font-bold text-primary text-sm sm:text-base flex items-center gap-2">
            <span>🛡️</span> Nguyên tắc Đạo đức & Bảo vệ Quyền riêng tư (Zero-PII On-chain)
          </div>
          <p className="text-xs sm:text-sm text-ink/80 leading-relaxed">
            Hệ thống RentFlow tuân thủ nghiêm ngặt quy định bảo mật: <strong>Tuyệt đối không đưa thông tin định danh cá nhân</strong> (Họ tên, Số điện thoại, CCCD, địa chỉ, hình ảnh bàn giao, nội dung văn bản hợp đồng) lên sổ cái blockchain. Dữ liệu on-chain chỉ gồm mã định danh nội bộ (UUID), mã băm mật mã SHA-256 có salt và các trạng thái chuyển đổi.
          </p>
        </section>

        {/* Search & Filter Bar */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/50 p-4 rounded-card border border-line">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold" data-lenis-prevent>
            <button
              onClick={() => setFilterAction("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterAction === "ALL" ? "bg-primary text-paper" : "bg-paper text-ink hover:bg-surface"
              }`}
            >
              Tất cả hành động
            </button>
            <button
              onClick={() => setFilterAction("create_contract")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterAction === "create_contract" ? "bg-primary text-paper" : "bg-paper text-ink hover:bg-surface"
              }`}
            >
              Ký hợp đồng
            </button>
            <button
              onClick={() => setFilterAction("record_deposit_paid")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterAction === "record_deposit_paid" ? "bg-primary text-paper" : "bg-paper text-ink hover:bg-surface"
              }`}
            >
              Ghi nhận cọc
            </button>
            <button
              onClick={() => setFilterAction("record_rent_paid")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterAction === "record_rent_paid" ? "bg-primary text-paper" : "bg-paper text-ink hover:bg-surface"
              }`}
            >
              Tiền thuê
            </button>
            <button
              onClick={() => setFilterAction("open_dispute")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterAction === "open_dispute" ? "bg-primary text-paper" : "bg-paper text-ink hover:bg-surface"
              }`}
            >
              Tranh chấp
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tra cứu theo mã hợp đồng hoặc Tx Hash..."
            className="px-3.5 py-1.5 rounded-xl border border-line bg-paper text-xs text-ink focus:outline-primary w-full sm:w-72"
          />
        </section>

        {/* Transactions Table */}
        <section className="bg-paper rounded-card border border-line p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-ink">
              Giao dịch đã ghi nhận ({filtered.length})
            </h2>
            <button
              onClick={loadTxs}
              className="text-xs text-primary font-bold hover:underline cursor-pointer"
            >
              Làm mới
            </button>
          </div>

          {loading ? (
            <LoadingSkeleton lines={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={loadTxs} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Không tìm thấy giao dịch nào"
              description="Không có bản ghi blockchain nào khớp với bộ lọc hoặc từ khóa tra cứu."
            />
          ) : (
            <div className="overflow-x-auto" data-lenis-prevent>
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-line text-ink/50 font-semibold">
                    <th className="py-3 px-3">Hành động pháp lý</th>
                    <th className="py-3 px-3">Hợp đồng</th>
                    <th className="py-3 px-3">Trạng thái sổ cái</th>
                    <th className="py-3 px-3">Mã giao dịch (Tx Hash)</th>
                    <th className="py-3 px-3">Thời điểm</th>
                    <th className="py-3 px-3 text-right">Khám phá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface/40 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-ink">
                        {tx.action}()
                      </td>
                      <td className="py-3.5 px-3">
                        <Link
                          href={`/app/hop-dong/${tx.contractId}#bang-chung`}
                          className="font-mono text-primary hover:underline font-semibold"
                        >
                          {tx.contractId}
                        </Link>
                      </td>
                      <td className="py-3.5 px-3">
                        <OnchainProofChip status={tx.status} />
                      </td>
                      <td className="py-3.5 px-3 font-mono text-ink/70">
                        {tx.txHash ? `${tx.txHash.slice(0, 10)}…${tx.txHash.slice(-8)}` : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-xs text-ink/60">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {tx.explorerUrl ? (
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-semibold hover:underline"
                          >
                            Stellar Expert ↗
                          </a>
                        ) : (
                          <span className="text-xs text-ink/40 italic">Chưa xác nhận explorer</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
