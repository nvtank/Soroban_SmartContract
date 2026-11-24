"use client";

import React, { useState, useEffect } from "react";
import type { OnchainTxDto } from "@/domain/dto";
import { apiClient } from "./api-client";
import { OnchainStamp } from "./onchain-stamp";
import { OnchainProofChip } from "@/components/shared";

export interface OnchainDrawerProps {
  contractId: string;
  docHash?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OnchainDrawer({
  contractId,
  docHash,
  isOpen,
  onClose,
}: OnchainDrawerProps) {
  const [txs, setTxs] = useState<OnchainTxDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    apiClient
      .getOnchainTxs(contractId)
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
  }, [contractId, isOpen]);

  const handleRetry = async (txId: string) => {
    setRetryingId(txId);
    setError(null);
    try {
      await apiClient.retryOnchainTx(txId);
      const updated = await apiClient.getOnchainTxs(contractId);
      setTxs(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Thử lại giao dịch thất bại");
    } finally {
      setRetryingId(null);
    }
  };

  if (!isOpen) return null;

  const confirmedTx = txs.find((t) => t.status === "CONFIRMED");

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-ink/50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onchain-drawer-title"
    >
      <div className="w-full max-w-md sm:max-w-lg bg-paper h-full shadow-lg border-l border-line flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface/40">
          <div>
            <h3 id="onchain-drawer-title" className="text-lg font-bold text-ink">
              Bằng chứng On-chain
            </h3>
            <p className="text-xs text-ink/60">Stellar Testnet • Hợp đồng {contractId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-ink/40 hover:text-ink hover:bg-surface cursor-pointer text-xl leading-none"
            aria-label="Đóng ngăn kéo"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm" data-lenis-prevent>
          {/* Stamp banner only when truly CONFIRMED */}
          {confirmedTx && (
            <div className="flex justify-center py-2">
              <OnchainStamp timestamp={confirmedTx.createdAt} />
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-brick/10 border border-brick/30 text-xs text-brick">
              ⚠️ {error}
            </div>
          )}

          {/* Non-PII Transparency Notice */}
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-ink space-y-1">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <span>🛡️</span> Không lưu trữ thông tin cá nhân (PII)
            </div>
            <p className="text-ink/80 text-[11px] leading-relaxed">
              Quy tắc trung thực Ideathon: Tên, SĐT, CCCD, địa chỉ, ảnh và nội dung văn bản không bao giờ được đưa lên blockchain. Sổ cái Stellar chỉ ghi nhận mã định danh hợp đồng nội bộ, mã băm SHA-256 có salt và các trạng thái pháp lý.
            </p>
          </div>

          {/* Contract Hash Details */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wider block">
              Mã băm SHA-256 hợp đồng (Salted Doc Hash):
            </span>
            <div className="p-2.5 rounded-lg bg-surface border border-line font-mono text-xs text-ink/80 break-all select-all">
              {docHash || "mock_doc_hash_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a"}
            </div>
          </div>

          {/* Transaction list */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-ink uppercase tracking-wider block">
              Nhật ký giao dịch Soroban ({txs.length}):
            </span>

            {loading ? (
              <div className="py-8 text-center text-xs text-ink/50 animate-pulse">
                Đang nạp nhật ký giao dịch…
              </div>
            ) : txs.length === 0 ? (
              <div className="p-4 rounded-xl bg-surface text-center text-xs text-ink/60">
                Chưa có giao dịch on-chain nào cho hợp đồng này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-surface/50 border border-line space-y-2 hover:border-line/80 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-ink">
                        {tx.action}()
                      </span>
                      <OnchainProofChip
                        status={tx.status}
                        txHash={tx.txHash}
                        explorerUrl={tx.explorerUrl}
                      />
                    </div>

                    <div className="font-mono text-[11px] text-ink/60 truncate flex items-center justify-between">
                      <span>Payload: {tx.payloadHash.slice(0, 24)}…</span>
                      {!tx.explorerUrl && (
                        <span className="text-[10px] text-ink/40 italic">Chưa xác nhận explorer</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink/50 pt-1 border-t border-line/40">
                      <span>{new Date(tx.createdAt).toLocaleString("vi-VN")}</span>
                      {tx.status === "FAILED" && (
                        <button
                          onClick={() => handleRetry(tx.id)}
                          disabled={retryingId === tx.id}
                          className="px-2 py-0.5 rounded bg-brick text-paper text-xs font-bold hover:bg-brick-ink cursor-pointer disabled:opacity-50"
                        >
                          {retryingId === tx.id ? "Đang thử lại…" : "Thử lại"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-surface/40">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-ink text-paper font-semibold hover:bg-ink/90 transition-colors cursor-pointer text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
