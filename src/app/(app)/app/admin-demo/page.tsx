"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/app/app-navbar";
import { apiClient } from "@/components/app/api-client";
import { MockBadge } from "@/components/shared";
import type { PendingRecovery } from "@/components/app/mock/mock-service";

export default function AdminDemoPage() {
  const [paymentMode, setPaymentMode] = useState<"payos" | "simulated" | "both">("both");
  const [recoveries, setRecoveries] = useState<PendingRecovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setPaymentMode(apiClient.getPaymentMode());
      const recs = await apiClient.getPendingRecoveries();
      setRecoveries(recs);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getPendingRecoveries()
      .then((recs) => {
        if (!ignore) {
          setPaymentMode(apiClient.getPaymentMode());
          setRecoveries(recs);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const handleReset = async () => {
    if (!confirm("Đặt lại toàn bộ dữ liệu demo về trạng thái ban đầu?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.resetDemo();
      setMessage("Đã đặt lại dữ liệu demo.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đặt lại dữ liệu thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiClient.seedDemo();
      setMessage("Đã khởi tạo 3 hợp đồng mẫu và đẩy hàng đợi lên Stellar Testnet.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nạp dữ liệu mẫu thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleOverdueScan = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiClient.runOverdueScan();
      setMessage(`Đã quét xong ${res.updatedCount} kỳ quá hạn.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Quét quá hạn thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleFlushOnchain = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiClient.flushOnchain();
      setMessage(`Đã xác nhận ${res.confirmedCount} giao dịch on-chain.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đẩy giao dịch on-chain thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentModeChange = (mode: "payos" | "simulated" | "both") => {
    apiClient.setPaymentMode(mode);
    setPaymentMode(mode);
    setMessage(`Chế độ thanh toán: ${mode}`);
  };

  const handleApproveRecovery = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.approveRecovery(id);
      setMessage("Đã phê duyệt yêu cầu khôi phục.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Duyệt yêu cầu thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 mx-auto max-w-5xl w-full px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                Quản trị kịch bản demo
              </h1>
              <MockBadge label="ADMIN" />
            </div>
            <p className="text-xs sm:text-sm text-ink/65">
              Duyệt yêu cầu khôi phục tài khoản và khởi tạo lại dữ liệu thử nghiệm.
            </p>
          </div>

          <Link
            href="/app"
            className="rounded-full border border-line bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-surface transition-colors"
          >
            ← Về bảng điều khiển
          </Link>
        </div>

        {message && (
          <div role="status" className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-xs sm:text-sm font-semibold text-primary-strong">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage(null)} className="text-xs font-bold cursor-pointer">
              Đóng
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center justify-between rounded-2xl border border-brick/30 bg-brick/10 px-4 py-3 text-xs sm:text-sm font-semibold text-brick-ink">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-xs font-bold cursor-pointer">
              Đóng
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {/* Recovery Approval (Primary Admin Action) */}
          <section className="md:col-span-2 rounded-[2rem] border border-line bg-paper p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-ink">
                Yêu cầu khôi phục tài khoản ({recoveries.length})
              </h2>
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="rounded-full border border-line px-3.5 py-1 text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
              >
                Làm mới
              </button>
            </div>

            {recoveries.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface/35 p-4 text-center text-xs text-ink/55">
                Không có yêu cầu khôi phục nào đang chờ duyệt.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recoveries.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/35 p-4 text-xs"
                  >
                    <div>
                      <div className="font-mono text-sm font-bold text-ink">{rec.phone}</div>
                      <div className="text-ink/55">
                        {new Date(rec.createdAt).toLocaleString("vi-VN")} · {rec.status}
                      </div>
                    </div>
                    {rec.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => handleApproveRecovery(rec.id)}
                        disabled={loading}
                        className="rounded-full bg-primary px-4 py-2 font-bold text-paper hover:bg-primary-strong cursor-pointer disabled:opacity-50"
                      >
                        Duyệt khôi phục
                      </button>
                    ) : (
                      <span className="font-bold text-primary-strong">Đã duyệt</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seed & Reset */}
          <section className="rounded-[2rem] border border-line bg-paper p-6 shadow-xs space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-ink">Dữ liệu mẫu</h2>
              <p className="text-xs text-ink/60">Khởi tạo 3 hợp đồng mẫu hoặc đặt lại trạng thái.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleSeed}
                disabled={loading}
                className="rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-paper hover:bg-ink/90 cursor-pointer disabled:opacity-50"
              >
                Nạp dữ liệu mẫu
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="rounded-full border border-brick/35 bg-brick/10 px-5 py-2.5 text-xs font-bold text-brick-ink hover:bg-brick/20 cursor-pointer disabled:opacity-50"
              >
                Đặt lại
              </button>
            </div>
          </section>

          {/* Jobs & Mode */}
          <section className="rounded-[2rem] border border-line bg-paper p-6 shadow-xs space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-ink">Tác vụ nền & Thanh toán</h2>
              <p className="text-xs text-ink/60">Quét kỳ quá hạn, đẩy giao dịch on-chain hoặc đổi cổng.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOverdueScan}
                disabled={loading}
                className="rounded-full border border-line px-4 py-2 text-xs font-bold text-ink hover:bg-surface cursor-pointer disabled:opacity-50"
              >
                Quét nợ quá hạn
              </button>
              <button
                type="button"
                onClick={handleFlushOnchain}
                disabled={loading}
                className="rounded-full border border-line px-4 py-2 text-xs font-bold text-ink hover:bg-surface cursor-pointer disabled:opacity-50"
              >
                Đẩy giao dịch On-chain
              </button>
            </div>
            <div className="flex rounded-full border border-line bg-surface p-1 text-xs font-semibold">
              {(
                [
                  { k: "both", l: "Cả hai" },
                  { k: "simulated", l: "Mô phỏng" },
                  { k: "payos", l: "payOS" },
                ] as const
              ).map((m) => (
                <button
                  key={m.k}
                  type="button"
                  onClick={() => handlePaymentModeChange(m.k)}
                  className={`flex-1 rounded-full py-1.5 cursor-pointer ${
                    paymentMode === m.k ? "bg-paper font-bold text-ink shadow-xs" : "text-ink/60"
                  }`}
                >
                  {m.l}
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
