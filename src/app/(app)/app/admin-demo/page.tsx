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

  const loadData = useCallback(async () => {
    setPaymentMode(apiClient.getPaymentMode());
    const recs = await apiClient.getPendingRecoveries();
    setRecoveries(recs);
  }, []);

  useEffect(() => {
    let ignore = false;
    apiClient.getPendingRecoveries().then((recs) => {
      if (!ignore) {
        setPaymentMode(apiClient.getPaymentMode());
        setRecoveries(recs);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const handleReset = async () => {
    if (!confirm("Bạn có chắc chắn muốn đặt lại toàn bộ dữ liệu demo về trạng thái ban đầu?")) return;
    setLoading(true);
    try {
      await apiClient.resetDemo();
      setMessage("Đã đặt lại dữ liệu demo thành công.");
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      await apiClient.seedDemo();
      setMessage("Đã nạp thành công 3 hợp đồng mẫu ở các trạng thái khác nhau.");
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleOverdueScan = async () => {
    setLoading(true);
    try {
      const res = await apiClient.runOverdueScan();
      setMessage(`Đã quét xong. Cập nhật ${res.updatedCount} kỳ thuê quá hạn và tự động tính phí trễ.`);
    } finally {
      setLoading(false);
    }
  };

  const handleFlushOnchain = async () => {
    setLoading(true);
    try {
      const res = await apiClient.flushOnchain();
      setMessage(`Worker Outbox đã xử lý. Đã ghi nhận thành công ${res.confirmedCount} giao dịch on-chain.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentModeChange = (mode: "payos" | "simulated" | "both") => {
    apiClient.setPaymentMode(mode);
    setPaymentMode(mode);
    setMessage(`Đã chuyển chế độ thanh toán sang: ${mode}`);
  };

  const handleApproveRecovery = async (id: string) => {
    await apiClient.approveRecovery(id);
    setMessage("Đã duyệt yêu cầu khôi phục tài khoản.");
    await loadData();
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                Bảng điều khiển Quản trị Thử nghiệm
              </h1>
              <MockBadge label="ADMIN DEMO" />
            </div>
            <p className="text-xs sm:text-sm text-ink/70">
              Khu vực hỗ trợ Ban giám khảo Ideathon thiết lập kịch bản trình diễn và thử nghiệm các tình huống ngoại lệ.
            </p>
          </div>

          <Link
            href="/app"
            className="px-4 py-2 rounded-xl bg-surface border border-line text-ink font-semibold text-xs sm:text-sm hover:bg-line/20 self-start sm:self-auto"
          >
            Vào ứng dụng App ➔
          </Link>
        </div>

        {message && (
          <div role="status" className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-xs sm:text-sm text-primary font-semibold flex items-center justify-between">
            <span>✓ {message}</span>
            <button onClick={() => setMessage(null)} className="cursor-pointer text-ink/40 hover:text-ink">
              ✕
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Box 1: Seed & Reset */}
          <div className="p-6 rounded-panel bg-surface/50 border border-line space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">1. Thiết lập & Đặt lại dữ liệu</h2>
              <MockBadge label="DATA RESET" />
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">
              Khởi tạo sẵn 1 chủ nhà, 2 người thuê và 3 hợp đồng ở các trạng thái: Chờ ký, Đang hiệu lực có kỳ quá hạn, và Đang tranh chấp khóa cọc.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleSeed}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-xs sm:text-sm text-center shadow-xs"
              >
                Nạp dữ liệu mẫu chuẩn (Seed)
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="py-2.5 px-4 rounded-xl border border-brick/40 text-brick bg-brick/10 font-bold hover:bg-brick/20 transition-colors cursor-pointer text-xs sm:text-sm text-center"
              >
                Đặt lại toàn bộ (Reset)
              </button>
            </div>
          </div>

          {/* Box 2: Cron Jobs & Workers */}
          <div className="p-6 rounded-panel bg-surface/50 border border-line space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">2. Tác vụ chạy nền (Background Jobs)</h2>
              <MockBadge label="CRON WORKER" />
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">
              Giả lập bộ quét định kỳ (Vercel Cron) để tự động tính tiền phạt trễ hạn hoặc đẩy các giao dịch on-chain trong outbox lên Stellar Testnet.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleOverdueScan}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-ink text-paper font-bold hover:bg-ink/90 transition-colors cursor-pointer text-xs sm:text-sm text-center shadow-xs"
              >
                Quét nợ quá hạn
              </button>
              <button
                onClick={handleFlushOnchain}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-paper border border-line text-ink font-bold hover:bg-surface transition-colors cursor-pointer text-xs sm:text-sm text-center shadow-xs"
              >
                Đẩy giao dịch On-chain
              </button>
            </div>
          </div>

          {/* Box 3: Payment Mode Configuration */}
          <div className="p-6 rounded-panel bg-surface/50 border border-line space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">3. Cấu hình chế độ thanh toán</h2>
              <MockBadge label={paymentMode.toUpperCase()} />
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">
              Lựa chọn giữa cổng thanh toán payOS thật, chế độ giả lập (Simulated) để diễn các lỗi thanh toán thiếu/thừa, hoặc cả hai.
            </p>

            <div className="grid grid-cols-3 gap-2 text-xs font-semibold pt-1">
              <button
                onClick={() => handlePaymentModeChange("both")}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMode === "both"
                    ? "bg-primary text-paper border-primary font-bold shadow-xs"
                    : "bg-paper text-ink border-line hover:bg-surface"
                }`}
              >
                Cả hai (Khuyên dùng)
              </button>
              <button
                onClick={() => handlePaymentModeChange("simulated")}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMode === "simulated"
                    ? "bg-primary text-paper border-primary font-bold shadow-xs"
                    : "bg-paper text-ink border-line hover:bg-surface"
                }`}
              >
                Chỉ mô phỏng
              </button>
              <button
                onClick={() => handlePaymentModeChange("payos")}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMode === "payos"
                    ? "bg-primary text-paper border-primary font-bold shadow-xs"
                    : "bg-paper text-ink border-line hover:bg-surface"
                }`}
              >
                Cổng payOS
              </button>
            </div>
          </div>

          {/* Box 4: Pending Account Recovery Requests */}
          <div className="p-6 rounded-panel bg-surface/50 border border-line space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">4. Yêu cầu khôi phục tài khoản</h2>
              <span className="text-xs text-ink/50">{recoveries.length} yêu cầu</span>
            </div>
            <p className="text-xs text-ink/70 leading-relaxed">
              Phê duyệt các yêu cầu cấp lại quyền truy cập sau khi người dùng hoàn tất bước eKYC mô phỏng.
            </p>

            <div className="space-y-2">
              {recoveries.length === 0 ? (
                <div className="p-3 bg-paper rounded-xl border border-line text-xs text-center text-ink/50">
                  Không có yêu cầu khôi phục nào đang chờ duyệt.
                </div>
              ) : (
                recoveries.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 bg-paper rounded-xl border border-line flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-ink">{rec.phone}</div>
                      <div className="text-[10px] text-ink/50">
                        {new Date(rec.createdAt).toLocaleTimeString("vi-VN")} • {rec.status}
                      </div>
                    </div>
                    {rec.status === "PENDING" ? (
                      <button
                        onClick={() => handleApproveRecovery(rec.id)}
                        className="px-3 py-1 rounded-lg bg-primary text-paper font-bold hover:bg-primary-strong cursor-pointer text-xs"
                      >
                        Duyệt ngay
                      </button>
                    ) : (
                      <span className="text-primary font-bold">Đã duyệt ✓</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
