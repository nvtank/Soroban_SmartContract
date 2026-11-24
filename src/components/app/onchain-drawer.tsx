"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

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
      className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onchain-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-line bg-paper shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3 id="onchain-drawer-title" className="text-base font-extrabold text-ink">
              Bằng chứng On-chain
            </h3>
            <p className="text-xs text-ink/55">Stellar Testnet · Không chứa dữ liệu cá nhân</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-surface hover:text-ink cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm" data-lenis-prevent>
          {confirmedTx && (
            <div className="flex justify-start">
              <OnchainStamp timestamp={confirmedTx.createdAt} />
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-2xl border border-brick/30 bg-brick/10 p-3 text-xs text-brick-ink">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-ink/70">Mã băm hợp đồng (SHA-256 + salt)</span>
            <div className="rounded-2xl border border-line bg-surface/50 p-3 font-mono text-xs text-ink/80 break-all select-all">
              {docHash || "Chưa có mã băm"}
            </div>
          </div>

          <div className="space-y-2.5">
            <span className="block text-xs font-bold text-ink/70">
              Giao dịch Soroban ({txs.length})
            </span>

            {loading ? (
              <div className="py-6 text-center text-xs text-ink/50 animate-pulse">
                Đang tải giao dịch…
              </div>
            ) : txs.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface/40 p-4 text-center text-xs text-ink/60">
                Chưa có giao dịch on-chain nào.
              </div>
            ) : (
              <div className="space-y-2.5">
                {txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-2xl border border-line bg-surface/35 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-ink">{tx.action}</span>
                      <OnchainProofChip
                        status={tx.status}
                        txHash={tx.txHash}
                        explorerUrl={tx.explorerUrl}
                        showIcon={false}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-ink/55">
                      <span>{new Date(tx.createdAt).toLocaleString("vi-VN")}</span>
                      {tx.status === "FAILED" && (
                        <button
                          type="button"
                          onClick={() => handleRetry(tx.id)}
                          disabled={retryingId === tx.id}
                          className="rounded-full bg-brick px-2.5 py-0.5 text-xs font-bold text-paper hover:bg-brick-ink cursor-pointer disabled:opacity-50"
                        >
                          {retryingId === tx.id ? "Đang thử…" : "Thử lại"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-line py-2.5 text-sm font-bold text-ink hover:bg-surface transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
