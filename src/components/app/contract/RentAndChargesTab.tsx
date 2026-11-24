"use client";

import React, { useState } from "react";
import { StatusBadge, MoneyAmount } from "@/components/shared";
import { formatDate } from "@/components/app/date-format";
import type { ContractDetailDto, ChargeDto, ChargeKind } from "@/domain/dto";

const CHARGE_KIND_LABELS: Record<string, string> = {
  ELECTRICITY: "Tiền điện",
  WATER: "Tiền nước",
  SERVICE: "Phí dịch vụ",
  OTHER: "Khoản khác",
};

function tomorrowIso(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("vi-VN").format(BigInt(digits));
}

export interface RentAndChargesTabProps {
  contract: ContractDetailDto;
  isTenant: boolean;
  isLandlord: boolean;
  onPayRent: (periodNo: number) => void;
  onExtendDue: (periodNo: number, newDueDate: string, resetForm: () => void) => void;
  onCreateCharge: (payload: {
    kind: ChargeKind;
    amount: string;
    note?: string;
    periodNo?: number;
  }) => Promise<void>;
  onMarkChargePaid: (chargeId: string) => Promise<void>;
}

export function RentAndChargesTab({
  contract,
  isTenant,
  isLandlord,
  onPayRent,
  onExtendDue,
  onCreateCharge,
  onMarkChargePaid,
}: RentAndChargesTabProps) {
  const [extendPeriod, setExtendPeriod] = useState<number | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [extendError, setExtendError] = useState<string | null>(null);

  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeKind, setChargeKind] = useState<ChargeKind>("ELECTRICITY");
  const [chargeAmountRaw, setChargeAmountRaw] = useState("");
  const [chargeNote, setChargeNote] = useState("");
  const [chargePeriod, setChargePeriod] = useState<string>("");
  const [addingCharge, setAddingCharge] = useState(false);
  const [chargeFormError, setChargeFormError] = useState<string | null>(null);

  const [confirmingCharge, setConfirmingCharge] = useState<ChargeDto | null>(null);
  const [markingChargePaid, setMarkingChargePaid] = useState(false);

  const unpaidRentTotal = (contract.rentPeriods || []).reduce((acc, p) => {
    if (p.status !== "PAID") {
      const due = BigInt(p.amountDue || "0");
      const paid = BigInt(p.amountPaid || "0");
      return acc + (due > paid ? due - paid : BigInt(0));
    }
    return acc;
  }, BigInt(0));

  const lateFeeTotal = (contract.rentPeriods || []).reduce(
    (acc, p) => acc + BigInt(p.lateFee || "0"),
    BigInt(0),
  );

  const chargesList: ChargeDto[] = contract.charges || [];
  const unpaidChargesTotal = chargesList.reduce(
    (acc, c) => (c.status === "UNPAID" ? acc + BigInt(c.amount || "0") : acc),
    BigInt(0),
  );

  const grandTotalDebt = unpaidRentTotal + lateFeeTotal + unpaidChargesTotal;

  const firstUnpaidPeriodNo = contract.rentPeriods.find((p) => p.status !== "PAID")?.periodNo;
  const firstOverduePeriodNo = contract.rentPeriods.find((p) => p.status === "OVERDUE")?.periodNo;

  const submitExtend = (periodNo: number) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extendDate)) {
      setExtendError("Vui lòng chọn hạn thanh toán mới.");
      return;
    }
    setExtendError(null);
    onExtendDue(periodNo, extendDate, () => {
      setExtendPeriod(null);
      setExtendDate("");
    });
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargeFormError(null);
    const digits = chargeAmountRaw.replace(/\D/g, "");
    if (!digits || BigInt(digits) <= BigInt(0)) {
      setChargeFormError("Vui lòng nhập số tiền lớn hơn 0.");
      return;
    }
    setAddingCharge(true);
    try {
      await onCreateCharge({
        kind: chargeKind,
        amount: digits,
        note: chargeNote.trim() || undefined,
        periodNo: chargePeriod ? Number(chargePeriod) : undefined,
      });
      setChargeAmountRaw("");
      setChargeNote("");
      setChargePeriod("");
      setShowChargeForm(false);
    } catch (err: unknown) {
      setChargeFormError(err instanceof Error ? err.message : "Thêm khoản phát sinh thất bại");
    } finally {
      setAddingCharge(false);
    }
  };

  const handleConfirmPaid = async () => {
    if (!confirmingCharge) return;
    setMarkingChargePaid(true);
    try {
      await onMarkChargePaid(confirmingCharge.id);
      setConfirmingCharge(null);
    } finally {
      setMarkingChargePaid(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 sm:p-8 space-y-8 w-full max-w-full min-w-0">
      {/* 1. Debt Summary */}
      <div className="rounded-3xl border border-line bg-surface/40 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-lg sm:text-xl font-extrabold text-ink">
              Tổng hợp công nợ hợp đồng
            </h2>
            <p className="text-xs text-ink/60">
              Gồm tiền thuê chưa trả, phí chậm trả và khoản phát sinh.
            </p>
          </div>
          <MoneyAmount value={grandTotalDebt.toString()} size="xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line/60 text-xs">
          <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-0.5">
            <span className="text-ink/55 block">Tiền thuê chưa trả</span>
            <MoneyAmount value={unpaidRentTotal.toString()} size="md" />
          </div>
          <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-0.5">
            <span className="text-ink/55 block">Phí chậm trả</span>
            <MoneyAmount
              value={lateFeeTotal.toString()}
              size="md"
              className={lateFeeTotal > BigInt(0) ? "text-brick-ink" : ""}
            />
          </div>
          <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-0.5">
            <span className="text-ink/55 block">Phát sinh chưa trả</span>
            <MoneyAmount value={unpaidChargesTotal.toString()} size="md" />
          </div>
        </div>
      </div>

      {/* 2. Rent Periods Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink">Kỳ tiền thuê</h3>
          <span className="text-xs text-ink/55">{contract.rentPeriods.length} kỳ</span>
        </div>

        {extendError && (
          <div role="alert" className="rounded-2xl border border-brick/30 bg-brick/10 p-3 text-xs font-medium text-brick-ink">
            {extendError}
          </div>
        )}

        <div className="sm:hidden text-[11px] text-ink/50 font-medium">
          ↔ Cuộn ngang để xem đầy đủ các kỳ
        </div>

        <div className="overflow-x-auto w-full max-w-full min-w-0 rounded-2xl border border-line" data-lenis-prevent>
          <table className="w-full min-w-[620px] text-left text-xs sm:text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-line bg-surface/50 text-ink/60 font-semibold">
                <th className="py-3 px-4">Kỳ</th>
                <th className="py-3 px-4">Hạn nộp</th>
                <th className="py-3 px-4">Phải nộp</th>
                <th className="py-3 px-4">Đã nộp</th>
                <th className="py-3 px-4">Phí trễ</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {contract.rentPeriods.map((period) => (
                <tr key={period.periodNo} className="hover:bg-surface/25 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-ink">Kỳ {period.periodNo}</td>
                  <td className="py-3.5 px-4 text-ink/80">{formatDate(period.dueDate)}</td>
                  <td className="py-3.5 px-4">
                    <MoneyAmount value={period.amountDue} size="sm" />
                  </td>
                  <td className="py-3.5 px-4">
                    <MoneyAmount value={period.amountPaid} size="sm" />
                  </td>
                  <td className="py-3.5 px-4">
                    {period.lateDays > 0 || period.lateFee !== "0" ? (
                      <span className="text-brick-ink font-semibold">
                        <MoneyAmount value={period.lateFee} size="sm" className="text-brick-ink" />
                        <span className="ml-1 text-[11px] font-normal">({period.lateDays} ngày)</span>
                      </span>
                    ) : (
                      <span className="text-ink/40">0 đ</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge kind="rent" status={period.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {isLandlord &&
                      contract.status === "ACTIVE" &&
                      period.status === "OVERDUE" &&
                      (extendPeriod === period.periodNo ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <input
                            type="date"
                            value={extendDate}
                            min={tomorrowIso()}
                            onChange={(e) => setExtendDate(e.target.value)}
                            aria-label="Hạn thanh toán mới"
                            className="rounded-xl border border-line bg-paper px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => submitExtend(period.periodNo)}
                            className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper hover:bg-ink/90 cursor-pointer"
                          >
                            Xác nhận
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExtendPeriod(null);
                              setExtendError(null);
                            }}
                            className="rounded-full border border-line px-2.5 py-1.5 text-xs text-ink/70 hover:bg-surface cursor-pointer"
                          >
                            Hủy
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-tour={
                            period.periodNo === firstOverduePeriodNo ? "extend-due" : undefined
                          }
                          onClick={() => setExtendPeriod(period.periodNo)}
                          className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-surface transition-colors cursor-pointer"
                        >
                          Gia hạn thanh toán
                        </button>
                      ))}

                    {period.status !== "PAID" && isTenant && (
                      <button
                        type="button"
                        data-tour={
                          period.periodNo === firstUnpaidPeriodNo ? "rent-pay" : undefined
                        }
                        onClick={() => onPayRent(period.periodNo)}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-paper hover:bg-primary-strong transition-colors cursor-pointer"
                      >
                        Nộp tiền
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Utility & Extra Charges */}
      <div className="space-y-4 pt-6 border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-ink">
              Khoản phát sinh (điện, nước, dịch vụ)
            </h3>
          </div>
          {isLandlord && contract.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => setShowChargeForm((v) => !v)}
              className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-surface transition-colors cursor-pointer"
            >
              {showChargeForm ? "Đóng biểu mẫu" : "+ Thêm khoản phát sinh"}
            </button>
          )}
        </div>

        {showChargeForm && isLandlord && contract.status === "ACTIVE" && (
          <form
            onSubmit={handleAddCharge}
            className="rounded-3xl border border-line bg-surface/40 p-5 space-y-4"
          >
            {chargeFormError && (
              <div role="alert" className="rounded-xl border border-brick/30 bg-brick/10 p-3 text-xs font-semibold text-brick-ink">
                {chargeFormError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink/75">Loại khoản</label>
                <select
                  value={chargeKind}
                  onChange={(e) => setChargeKind(e.target.value as ChargeKind)}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs sm:text-sm text-ink"
                >
                  <option value="ELECTRICITY">Tiền điện</option>
                  <option value="WATER">Tiền nước</option>
                  <option value="SERVICE">Phí dịch vụ</option>
                  <option value="OTHER">Khoản khác</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink/75">Số tiền (đ)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatDigits(chargeAmountRaw)}
                  onChange={(e) => setChargeAmountRaw(e.target.value.replace(/\D/g, ""))}
                  placeholder="350.000"
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-xs sm:text-sm text-ink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink/75">Kỳ liên quan</label>
                <select
                  value={chargePeriod}
                  onChange={(e) => setChargePeriod(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs sm:text-sm text-ink"
                >
                  <option value="">Ngoài kỳ</option>
                  {contract.rentPeriods.map((p) => (
                    <option key={p.periodNo} value={p.periodNo}>
                      Kỳ {p.periodNo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-ink/75">Ghi chú</label>
                <input
                  type="text"
                  value={chargeNote}
                  onChange={(e) => setChargeNote(e.target.value)}
                  placeholder="Ví dụ: 150 kWh"
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs sm:text-sm text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingCharge}
                className="rounded-full bg-ink px-5 py-2 text-xs font-bold text-paper hover:bg-ink/90 cursor-pointer disabled:opacity-50"
              >
                {addingCharge ? "Đang lưu…" : "Lưu khoản phát sinh"}
              </button>
            </div>
          </form>
        )}

        {chargesList.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface/25 p-4 text-center text-xs text-ink/55">
            Chưa có khoản phát sinh nào.
          </p>
        ) : (
          <div className="overflow-x-auto w-full max-w-full min-w-0 rounded-2xl border border-line" data-lenis-prevent>
            <table className="w-full min-w-[540px] text-left text-xs sm:text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-line bg-surface/50 text-ink/60 font-semibold">
                  <th className="py-2.5 px-4">Khoản</th>
                  <th className="py-2.5 px-4">Kỳ</th>
                  <th className="py-2.5 px-4">Ghi chú</th>
                  <th className="py-2.5 px-4">Số tiền</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {chargesList.map((charge) => (
                  <tr key={charge.id} className="hover:bg-surface/25">
                    <td className="py-3 px-4 font-bold text-ink">
                      {CHARGE_KIND_LABELS[charge.kind] || charge.kind}
                    </td>
                    <td className="py-3 px-4 text-ink/70">
                      {charge.periodNo ? `Kỳ ${charge.periodNo}` : "Ngoài kỳ"}
                    </td>
                    <td className="py-3 px-4 text-ink/75 max-w-xs truncate">
                      {charge.note || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <MoneyAmount value={charge.amount} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge kind="charge" status={charge.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLandlord && contract.status === "ACTIVE" && charge.status === "UNPAID" ? (
                        <button
                          type="button"
                          onClick={() => setConfirmingCharge(charge)}
                          className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold text-ink hover:bg-surface cursor-pointer"
                        >
                          Đã nhận ngoài hệ thống
                        </button>
                      ) : (
                        <span className="text-xs text-ink/45">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm off-system payment dialog */}
      {confirmingCharge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-charge-title"
        >
          <div className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-6 shadow-soft space-y-4">
            <h3 id="confirm-charge-title" className="text-base font-extrabold text-ink">
              Xác nhận nhận tiền ngoài hệ thống
            </h3>
            <p className="rounded-2xl border border-amber/35 bg-amber/12 p-3 text-xs text-amber-ink leading-relaxed">
              Đây là chủ nhà tự ghi nhận, <strong>không phải xác nhận của ngân hàng</strong>.
            </p>
            <div className="rounded-2xl border border-line bg-surface/40 p-3.5 text-xs space-y-1">
              <div>
                Khoản: <strong>{CHARGE_KIND_LABELS[confirmingCharge.kind] || confirmingCharge.kind}</strong>
              </div>
              <div>
                Số tiền: <MoneyAmount value={confirmingCharge.amount} size="sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCharge(null)}
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-surface cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPaid}
                disabled={markingChargePaid}
                className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper hover:bg-ink/90 cursor-pointer disabled:opacity-50"
              >
                {markingChargePaid ? "Đang lưu…" : "Xác nhận đã nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
