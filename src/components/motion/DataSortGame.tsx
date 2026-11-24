"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, RotateCcw, Database, Blocks, Info } from "lucide-react";

type DataItem = {
  id: string;
  label: string;
  correctZone: "offchain" | "onchain";
  description: string;
};

const INITIAL_ITEMS: readonly DataItem[] = [
  { id: "name", label: "Họ và tên người thuê", correctZone: "offchain", description: "Dữ liệu cá nhân định danh (PII)" },
  { id: "phone", label: "Số điện thoại liên hệ", correctZone: "offchain", description: "Dữ liệu liên lạc cá nhân" },
  { id: "id_card", label: "Số CCCD / CMND", correctZone: "offchain", description: "Thông tin nhạy cảm bảo mật cao" },
  { id: "handover_notes", label: "Biên bản bàn giao phòng (Lộ trình: kèm ảnh)", correctZone: "offchain", description: "Văn bản hiện trạng off-chain (chưa có lưu trữ ảnh bàn giao)" },
  { id: "contract_terms", label: "Toàn văn hợp đồng thuê", correctZone: "offchain", description: "Văn bản chứa thông tin riêng tư" },
  { id: "doc_hash", label: "Mã băm SHA-256 hợp đồng", correctZone: "onchain", description: "Bằng chứng bất biến có kèm chuỗi muối" },
  { id: "deposit_status", label: "Trạng thái tiền cọc", correctZone: "onchain", description: "Máy trạng thái u32 kiểm tra quyền" },
  { id: "money_amount", label: "Số tiền cọc & Phí trễ", correctZone: "onchain", description: "Số nguyên i128 VND ghi nhận tham số hợp đồng (không giữ VNĐ thật)" },
];

export function DataSortGame() {
  const [unassignedItems, setUnassignedItems] = useState<DataItem[]>([...INITIAL_ITEMS]);
  const [offchainItems, setOffchainItems] = useState<DataItem[]>([]);
  const [onchainItems, setOnchainItems] = useState<DataItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakingZone, setShakingZone] = useState<"offchain" | "onchain" | null>(null);
  const [selectedItem, setSelectedItem] = useState<DataItem | null>(null);

  const handleAssign = (item: DataItem, targetZone: "offchain" | "onchain") => {
    setErrorMessage(null);

    // Kiểm tra đúng / sai
    if (item.correctZone !== targetZone) {
      setShakingZone(targetZone);
      if (targetZone === "onchain") {
        setErrorMessage(
          `CẢNH BÁO ĐẠO ĐỨC: "${item.label}" là dữ liệu cá nhân (PII), tuyệt đối KHÔNG được đưa lên blockchain công khai!`
        );
      } else {
        setErrorMessage(
          `CHƯA CHÍNH XÁC: "${item.label}" là bằng chứng trạng thái hoặc mã băm cần đưa lên On-chain để đảm bảo tính bất biến.`
        );
      }
      setTimeout(() => setShakingZone(null), 600);
      return;
    }

    // Đưa vào vùng đúng
    setUnassignedItems((prev) => prev.filter((i) => i.id !== item.id));
    if (targetZone === "offchain") {
      setOffchainItems((prev) => [...prev, item]);
    } else {
      setOnchainItems((prev) => [...prev, item]);
    }
    setSelectedItem(null);
  };

  const handleReset = () => {
    setUnassignedItems([...INITIAL_ITEMS]);
    setOffchainItems([]);
    setOnchainItems([]);
    setErrorMessage(null);
    setSelectedItem(null);
  };

  const isCompleted = unassignedItems.length === 0;

  return (
    <div className="w-full rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-soft">
      {/* Header trò chơi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
            <Info className="h-4 w-4" />
            <span>Mini-game tương tác</span>
          </div>
          <h3 className="mt-1 text-xl sm:text-2xl font-bold text-ink">
            Kéo thả phân loại dữ liệu On-Chain & Off-Chain
          </h3>
          <p className="mt-1 text-sm text-ink/70">
            Chọn một mảnh dữ liệu bên dưới và nhấn nút chuyển vào vùng lưu trữ tương ứng:
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink/75 hover:border-primary hover:text-primary transition-colors"
          data-cursor-hover="true"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Làm lại từ đầu</span>
        </button>
      </div>

      {/* Thông báo lỗi nếu đặt sai vùng */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-brick/40 bg-brick/10 p-4 text-sm font-medium text-brick-ink animate-in fade-in zoom-in-95"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-brick mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Lỗi vi phạm nguyên tắc kiến trúc:</span>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Thông báo hoàn thành */}
      {isCompleted && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm font-bold text-primary-strong animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          <span>Tuyệt vời! Bạn đã phân chia hoàn hảo ranh giới bảo mật giữa Off-Chain và On-Chain.</span>
        </div>
      )}

      {/* Khay dữ liệu chưa gán (Unassigned Pool) */}
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/50 p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
          Các mảnh dữ liệu cần phân loại ({unassignedItems.length}/{INITIAL_ITEMS.length}):
        </span>

        {unassignedItems.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2.5">
            {unassignedItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border p-2.5 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-line bg-paper hover:border-primary/50"
                  }`}
                >
                  <span className="text-xs sm:text-sm font-bold text-ink">{item.label}</span>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleAssign(item, "offchain")}
                      className="rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold text-ink/80 hover:bg-ink hover:text-paper transition-colors"
                      data-cursor-hover="true"
                    >
                      → Off-chain
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssign(item, "onchain")}
                      className="rounded-lg bg-primary/20 px-2 py-1 text-[11px] font-semibold text-primary-strong hover:bg-primary hover:text-paper transition-colors"
                      data-cursor-hover="true"
                    >
                      → On-chain
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs italic text-ink/50">Tất cả dữ liệu đã được đưa vào đúng vùng an toàn.</p>
        )}
      </div>

      {/* Hai vùng đích: Off-Chain vs On-Chain */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vùng Off-Chain (Supabase) */}
        <div
          className={`flex flex-col rounded-2xl border-2 p-5 ${
            shakingZone === "offchain"
              ? "border-brick bg-brick/10 ring-2 ring-brick/30"
              : "border-line bg-surface/30"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-ink/70" />
              <div>
                <h4 className="text-base font-bold text-ink">Off-chain (Supabase)</h4>
                <span className="text-[11px] text-ink/60">Lưu trữ bảo mật • Row Level Security (RLS)</span>
              </div>
            </div>
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-mono font-bold text-ink/60">
              {offchainItems.length}
            </span>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-2 min-h-[140px]">
            {offchainItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-ink/40 italic">
                Chưa có dữ liệu nào trong vùng Off-chain
              </div>
            ) : (
              offchainItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-xs"
                >
                  <span>{item.label}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Vùng On-Chain (Stellar Soroban) */}
        <div
          className={`flex flex-col rounded-2xl border-2 p-5 ${
            shakingZone === "onchain"
              ? "border-brick bg-brick/10 ring-2 ring-brick/30"
              : "border-primary/40 bg-primary/5"
          }`}
        >
          <div className="flex items-center justify-between border-b border-primary/20 pb-3">
            <div className="flex items-center gap-2">
              <Blocks className="h-5 w-5 text-primary" />
              <div>
                <h4 className="text-base font-bold text-primary-strong">On-chain (Stellar Soroban)</h4>
                <span className="text-[11px] text-primary/80">Sổ cái công khai bất biến • CẤM dữ liệu PII</span>
              </div>
            </div>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary-strong">
              {onchainItems.length}
            </span>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-2 min-h-[140px]">
            {onchainItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-primary/60 italic">
                Chưa có dữ liệu nào trong vùng On-chain
              </div>
            ) : (
              onchainItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-primary/30 bg-paper px-3 py-2 text-xs font-semibold text-primary-strong shadow-xs"
                >
                  <span>{item.label}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
