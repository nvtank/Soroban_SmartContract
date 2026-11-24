"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { apiClient } from "@/components/app/api-client";
import { StepUpModal } from "@/components/app/step-up-modal";

function formatVndDigits(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return "";
  return new Intl.NumberFormat("vi-VN").format(BigInt(clean));
}

export default function NewContractPage() {
  const router = useRouter();
  const { role, loginAs } = useSession();

  const [formData, setFormData] = useState({
    roomLabel: "Phòng 401 - Căn hộ Studio Cầu Giấy",
    rentAmount: "6500000",
    depositAmount: "6500000",
    startDate: "2026-12-01",
    endDate: "2027-11-30",
    dueDay: 5,
    lateFeeRate: 0.1,
    tenantPhone: "0900000002",
    tenantName: "Trần Thị Bình",
    termsText:
      "Bên thuê thanh toán tiền thuê đúng hạn trước ngày 05 hàng tháng. Tiền cọc được ghi nhận trạng thái trung lập và chỉ giải ngân khi cả hai bên cùng xác nhận.",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStepUp, setShowStepUp] = useState(false);

  const fieldErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!formData.roomLabel.trim()) {
      errs.roomLabel = "Nhập tên phòng hoặc căn hộ.";
    }
    const phoneDigits = formData.tenantPhone.trim();
    if (!phoneDigits || phoneDigits.length < 8) {
      errs.tenantPhone = "Số điện thoại cần tối thiểu 8 chữ số.";
    }
    const rent = Number(formData.rentAmount || "0");
    if (isNaN(rent) || rent < 500000) {
      errs.rentAmount = "Giá thuê tối thiểu 500.000 đ.";
    }
    const deposit = Number(formData.depositAmount || "0");
    if (isNaN(deposit) || deposit < 500000) {
      errs.depositAmount = "Tiền cọc tối thiểu 500.000 đ.";
    }
    if (!formData.startDate || !formData.endDate || new Date(formData.endDate) <= new Date(formData.startDate)) {
      errs.endDate = "Ngày kết thúc phải sau ngày bắt đầu.";
    }
    if (formData.dueDay < 1 || formData.dueDay > 28) {
      errs.dueDay = "Chọn ngày từ 1 đến 28.";
    }
    if (formData.lateFeeRate < 0 || formData.lateFeeRate > 1) {
      errs.lateFeeRate = "Mức phí từ 0% đến 1% / ngày.";
    }
    return errs;
  }, [formData]);

  const isValid = Object.keys(fieldErrors).length === 0;

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValid) {
      setError("Vui lòng kiểm tra lại các trường báo đỏ.");
      return;
    }
    setShowStepUp(true);
  };

  const handleFinalSubmit = async () => {
    setShowStepUp(false);
    setLoading(true);
    setError(null);
    try {
      const lateFeeBpsPerDay = Math.round(formData.lateFeeRate * 100);
      const created = await apiClient.createContract({
        roomLabel: formData.roomLabel.trim(),
        rentAmount: formData.rentAmount,
        depositAmount: formData.depositAmount,
        startDate: formData.startDate,
        endDate: formData.endDate,
        dueDay: formData.dueDay,
        lateFeeBpsPerDay,
        tenantPhone: formData.tenantPhone.trim(),
        tenantName: formData.tenantName.trim(),
        termsText: formData.termsText.trim(),
      });

      router.push(`/app/hop-dong/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tạo hợp đồng");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 mx-auto max-w-2xl w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="space-y-2">
          <Link href="/app" className="inline-block text-xs font-semibold text-ink/60 hover:text-ink">
            ← Bảng điều khiển
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Tạo hợp đồng mới
          </h1>
          <p className="text-sm text-ink/65">
            Điền thông tin phòng và điều khoản để gửi người thuê ký xác nhận.
          </p>
        </div>

        {role !== "LANDLORD" && role !== "ADMIN_DEMO" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/35 bg-amber/12 p-4 text-xs sm:text-sm text-amber-ink">
            <span>Chỉ tài khoản Chủ nhà mới lập được hợp đồng mới.</span>
            <button
              type="button"
              onClick={() => loginAs("landlord")}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-paper cursor-pointer"
            >
              Đổi sang Chủ nhà
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl border border-brick/30 bg-brick/10 p-4 text-xs sm:text-sm font-semibold text-brick-ink">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmitForm} className="space-y-6 pb-8">
          {/* Group 1: Room & Tenant */}
          <section className="rounded-[2rem] border border-line bg-paper p-6 sm:p-7 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-ink">1. Phòng & Người thuê</h2>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink/80">Tên phòng / căn hộ</label>
              <input
                type="text"
                value={formData.roomLabel}
                onChange={(e) => setFormData({ ...formData, roomLabel: e.target.value })}
                placeholder="Ví dụ: Phòng 302 - Căn hộ Kim Mã"
                className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 text-sm text-ink focus:outline-primary"
                required
              />
              {fieldErrors.roomLabel && (
                <p className="text-xs font-medium text-brick-ink">{fieldErrors.roomLabel}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Số điện thoại người thuê</label>
                <input
                  type="tel"
                  value={formData.tenantPhone}
                  onChange={(e) => setFormData({ ...formData, tenantPhone: e.target.value })}
                  placeholder="0900000002"
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 font-mono text-sm text-ink focus:outline-primary"
                  required
                />
                {fieldErrors.tenantPhone && (
                  <p className="text-xs font-medium text-brick-ink">{fieldErrors.tenantPhone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Họ tên người thuê</label>
                <input
                  type="text"
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  placeholder="Trần Thị Bình"
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 text-sm text-ink focus:outline-primary"
                />
              </div>
            </div>
          </section>

          {/* Group 2: Amounts & Schedule */}
          <section className="rounded-[2rem] border border-line bg-paper p-6 sm:p-7 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-ink">2. Số tiền & Kỳ hạn</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Giá thuê hàng tháng</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatVndDigits(formData.rentAmount)}
                    onChange={(e) =>
                      setFormData({ ...formData, rentAmount: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="6.500.000"
                    className="w-full rounded-2xl border border-line bg-surface/35 pl-4 pr-10 py-2.5 tabular font-bold text-base text-ink focus:outline-primary"
                    required
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/50">
                    đ
                  </span>
                </div>
                {fieldErrors.rentAmount && (
                  <p className="text-xs font-medium text-brick-ink">{fieldErrors.rentAmount}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Tiền cọc bảo chứng</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatVndDigits(formData.depositAmount)}
                    onChange={(e) =>
                      setFormData({ ...formData, depositAmount: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder="6.500.000"
                    className="w-full rounded-2xl border border-line bg-surface/35 pl-4 pr-10 py-2.5 tabular font-bold text-base text-ink focus:outline-primary"
                    required
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/50">
                    đ
                  </span>
                </div>
                {fieldErrors.depositAmount && (
                  <p className="text-xs font-medium text-brick-ink">{fieldErrors.depositAmount}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 text-sm text-ink focus:outline-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Ngày kết thúc</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 text-sm text-ink focus:outline-primary"
                  required
                />
                {fieldErrors.endDate && (
                  <p className="text-xs font-medium text-brick-ink">{fieldErrors.endDate}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Ngày thu hàng tháng (1–28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={formData.dueDay}
                  onChange={(e) => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 font-mono text-sm text-ink focus:outline-primary"
                  required
                />
                {fieldErrors.dueDay && (
                  <p className="text-xs font-medium text-brick-ink">{fieldErrors.dueDay}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-ink/80">Phí chậm trả (% / ngày)</label>
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={formData.lateFeeRate}
                  onChange={(e) => setFormData({ ...formData, lateFeeRate: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-2.5 font-mono text-sm text-ink focus:outline-primary"
                  required
                />
                {fieldErrors.lateFeeRate && (
                  <p className="text-xs font-medium text-brick-ink">{fieldErrors.lateFeeRate}</p>
                )}
              </div>
            </div>
          </section>

          {/* Group 3: Terms */}
          <section className="rounded-[2rem] border border-line bg-paper p-6 sm:p-7 shadow-xs space-y-3">
            <h2 className="text-base font-extrabold text-ink">3. Điều khoản thỏa thuận</h2>
            <textarea
              rows={4}
              value={formData.termsText}
              onChange={(e) => setFormData({ ...formData, termsText: e.target.value })}
              className="w-full rounded-2xl border border-line bg-surface/35 px-4 py-3 text-sm text-ink leading-relaxed focus:outline-primary"
              placeholder="Ghi rõ quy định bàn giao và bảo quản tài sản…"
            />
            <p className="text-xs text-ink/55">
              Khi ký, nội dung hợp đồng được băm SHA-256 kèm muối để làm bằng chứng đối chiếu, không lưu thông tin cá nhân lên chuỗi.
            </p>
          </section>

          {/* Sticky / Clear Action Footer */}
          <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-full border border-line bg-paper/95 p-2 pl-5 shadow-soft backdrop-blur-md">
            <Link
              href="/app"
              className="text-xs sm:text-sm font-semibold text-ink/70 hover:text-ink transition-colors"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-paper transition-colors hover:bg-ink/90 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Đang tạo…" : "Ký & Tạo hợp đồng"}
            </button>
          </div>
        </form>
      </main>

      {showStepUp && (
        <StepUpModal
          action="SIGN_CONTRACT"
          title="Ký khởi tạo hợp đồng"
          description="Xác thực để tạo hợp đồng và gửi cho người thuê xác nhận."
          onSuccess={handleFinalSubmit}
          onCancel={() => setShowStepUp(false)}
        />
      )}
    </div>
  );
}
