"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { apiClient } from "@/components/app/api-client";
import { HashPreview } from "@/components/app/hash-preview";
import { StepUpModal } from "@/components/app/step-up-modal";

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
    lateFeeRate: 0.1, // 0.1% per day = 10 bps
    tenantPhone: "0987654321",
    tenantName: "Trần Thị Bình",
    termsText:
      "Bên thuê thanh toán tiền thuê đúng hạn trước ngày 05 hàng tháng. Giữ gìn an ninh trật tự và bảo quản trang thiết bị nội thất. Tiền cọc được bảo chứng trung lập trên RentFlow và chỉ giải ngân khi cả hai bên xác nhận hoàn tất nghiệm thu trả phòng.",
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStepUp, setShowStepUp] = useState(false);

  const validateStep1 = () => {
    if (!formData.roomLabel.trim()) return "Vui lòng nhập tên phòng / căn hộ.";
    if (!formData.tenantPhone.trim() || formData.tenantPhone.length < 10)
      return "Số điện thoại người thuê phải có ít nhất 10 số.";
    return null;
  };

  const validateStep2 = () => {
    const rent = Number(formData.rentAmount);
    const deposit = Number(formData.depositAmount);
    if (isNaN(rent) || rent < 500000) return "Giá thuê tối thiểu là 500.000 ₫.";
    if (isNaN(deposit) || deposit < 500000) return "Tiền cọc tối thiểu là 500.000 ₫.";
    if (new Date(formData.endDate) <= new Date(formData.startDate))
      return "Ngày kết thúc phải sau ngày bắt đầu thuê.";
    if (formData.dueDay < 1 || formData.dueDay > 28)
      return "Ngày thanh toán hàng tháng phải từ 1 đến 28.";
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setStep(3);
    }
  };

  const handleTriggerSign = () => {
    setError(null);
    setShowStepUp(true);
  };

  const handleFinalSubmit = async () => {
    setShowStepUp(false);
    setLoading(true);
    setError(null);
    try {
      const lateFeeBpsPerDay = Math.round(formData.lateFeeRate * 100);
      const created = await apiClient.createContract({
        roomLabel: formData.roomLabel,
        rentAmount: formData.rentAmount,
        depositAmount: formData.depositAmount,
        startDate: formData.startDate,
        endDate: formData.endDate,
        dueDay: formData.dueDay,
        lateFeeBpsPerDay,
        tenantPhone: formData.tenantPhone,
        tenantName: formData.tenantName,
        termsText: formData.termsText,
      });

      router.push(`/app/hop-dong/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tạo hợp đồng");
      setLoading(false);
    }
  };

  // Canonical payload representation for hash preview
  const canonicalPreview = {
    due_day: formData.dueDay,
    end_date: formData.endDate,
    late_fee_bps_per_day: Math.round(formData.lateFeeRate * 100),
    rent_amount: formData.rentAmount,
    deposit_amount: formData.depositAmount,
    room_label: formData.roomLabel,
    start_date: formData.startDate,
    terms_text: formData.termsText,
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-ink/60">
          <Link href="/app" className="hover:text-primary transition-colors">
            Bảng điều khiển
          </Link>
          <span>/</span>
          <span className="text-ink font-semibold">Tạo hợp đồng mới</span>
        </div>

        {/* Role Check Warning if not Landlord */}
        {role !== "LANDLORD" && (
          <div className="p-4 rounded-xl bg-amber/15 border border-amber/40 flex items-center justify-between text-xs sm:text-sm text-amber-ink">
            <span>Bạn đang xem với vai trò Người thuê. Chỉ Chủ nhà mới có quyền lập hợp đồng cho thuê mới.</span>
            <button
              onClick={() => loginAs("landlord")}
              className="px-3 py-1 rounded-lg bg-amber text-paper font-bold cursor-pointer whitespace-nowrap"
            >
              Chuyển sang Chủ nhà
            </button>
          </div>
        )}

        {/* Wizard Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Tạo hợp đồng cho thuê mới
          </h1>
          <p className="text-xs sm:text-sm text-ink/70">
            Hợp đồng sau khi tạo sẽ được băm SHA-256 có salt và ghi nhận trạng thái lên sổ cái Stellar Testnet.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between border-b border-line pb-4 text-xs sm:text-sm">
          <div className={`font-bold ${step >= 1 ? "text-primary" : "text-ink/40"}`}>
            1. Bất động sản & Người thuê
          </div>
          <div className={`font-bold ${step >= 2 ? "text-primary" : "text-ink/40"}`}>
            2. Giá thuê & Kỳ hạn
          </div>
          <div className={`font-bold ${step >= 3 ? "text-primary" : "text-ink/40"}`}>
            3. Điều khoản & Ký số
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-surface/50 rounded-panel border border-line p-6 sm:p-8 shadow-soft space-y-6">
          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-brick/10 border border-brick/30 text-brick text-xs sm:text-sm font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                1. Thông tin bất động sản & Người thuê
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-ink block">
                  Tên phòng / Mã căn hộ *
                </label>
                <input
                  type="text"
                  value={formData.roomLabel}
                  onChange={(e) => setFormData({ ...formData, roomLabel: e.target.value })}
                  placeholder="Ví dụ: Phòng 302 - Căn hộ Dịch vụ Kim Mã"
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm sm:text-base focus:outline-primary"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Số điện thoại người thuê *
                  </label>
                  <input
                    type="tel"
                    value={formData.tenantPhone}
                    onChange={(e) => setFormData({ ...formData, tenantPhone: e.target.value })}
                    placeholder="Ví dụ: 0987654321"
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-sm sm:text-base focus:outline-primary"
                    required
                  />
                  <p className="text-[11px] text-ink/50">
                    Người thuê sẽ nhận thông báo và link ký xác nhận qua số này.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Họ và tên người thuê (dự kiến)
                  </label>
                  <input
                    type="text"
                    value={formData.tenantName}
                    onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                    placeholder="Ví dụ: Trần Thị Bình"
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm sm:text-base focus:outline-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                2. Giá thuê, Tiền cọc & Lịch thanh toán
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Giá thuê hàng tháng (₫) *
                  </label>
                  <input
                    type="number"
                    step="100000"
                    value={formData.rentAmount}
                    onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-sm sm:text-base focus:outline-primary"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Tiền cọc bảo chứng (₫) *
                  </label>
                  <input
                    type="number"
                    step="100000"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-sm sm:text-base focus:outline-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Ngày bắt đầu thuê *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-primary"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Ngày kết thúc thuê *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-sm focus:outline-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Ngày thanh toán mỗi tháng (1 - 28) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={formData.dueDay}
                    onChange={(e) => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-sm focus:outline-primary"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-ink block">
                    Phí phạt chậm trả (% / ngày) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={formData.lateFeeRate}
                    onChange={(e) => setFormData({ ...formData, lateFeeRate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink font-mono text-sm focus:outline-primary"
                    required
                  />
                  <p className="text-[11px] text-ink/50">
                    {formData.lateFeeRate}% / ngày tương đương {Math.round(formData.lateFeeRate * 100)} bps.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                3. Điều khoản & Xem trước mã băm bảo chứng
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-ink block">
                  Điều khoản bổ sung
                </label>
                <textarea
                  rows={4}
                  value={formData.termsText}
                  onChange={(e) => setFormData({ ...formData, termsText: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-paper text-ink text-xs sm:text-sm focus:outline-primary"
                  placeholder="Ghi rõ quy định về điện nước, bảo quản tài sản..."
                />
              </div>

              {/* Hash Preview Component */}
              <HashPreview
                content={canonicalPreview}
                label="Xem trước mã băm SHA-256 dự kiến đưa lên Stellar Testnet"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="px-5 py-2.5 rounded-xl border border-line text-ink font-semibold hover:bg-surface transition-colors cursor-pointer text-sm"
              >
                Quay lại
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
              >
                Tiếp tục ➔
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTriggerSign}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-sm shadow-xs"
              >
                {loading ? "Đang xử lý…" : "Ký & Khởi tạo hợp đồng"}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Step up signature modal */}
      {showStepUp && (
        <StepUpModal
          action="SIGN_CONTRACT"
          title="Ký khởi tạo hợp đồng cho thuê"
          description="Chữ ký bảo mật Passkey/OTP của bạn sẽ xác nhận nội dung hợp đồng và tạo giao dịch on-chain đầu tiên."
          onSuccess={handleFinalSubmit}
          onCancel={() => setShowStepUp(false)}
        />
      )}
    </div>
  );
}
