import { OnchainProofChip } from "@/components/shared/OnchainProofChip";
import { marketingVi } from "@/i18n/sections/marketing";
import { DatabaseZap } from "lucide-react";
import type { OnchainTxStatus } from "@/domain/states";

export type OnchainTxItem = {
  id: string;
  action: string;
  txHash: string;
  status: OnchainTxStatus;
  createdAt?: string;
};

export type TestnetMarqueeProps = {
  transactions?: readonly OnchainTxItem[];
  className?: string;
};

export function TestnetMarquee({ transactions = [], className = "" }: TestnetMarqueeProps) {
  const hasTransactions = transactions.length > 0;

  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-line bg-surface/40 p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DatabaseZap className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-ink/75">
            {marketingVi.chapter04.marqueeTitle}
          </span>
        </div>
        <span className="text-[11px] font-mono text-ink/50">Stellar Testnet (RPC Soroban)</span>
      </div>

      {hasTransactions ? (
        <div className="relative w-full overflow-hidden py-2">
          <div className="animate-marquee-track flex gap-4">
            {/* Nhân đôi danh sách để tạo chuỗi vô tận không đứt gãy */}
            {[...transactions, ...transactions].map((tx, idx) => (
              <div
                key={`${tx.id}-${idx}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 shadow-xs"
              >
                <span className="font-mono text-xs font-bold text-primary-strong">
                  {tx.action}
                </span>
                <OnchainProofChip
                  status={tx.status}
                  txHash={tx.txHash}
                  explorerUrl={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Trạng thái rỗng trung thực tuyệt đối - Không dùng hash giả */
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-paper/60 px-6 py-8 text-center">
          <p className="text-sm font-medium text-ink/70">
            {marketingVi.chapter04.marqueeEmpty}
          </p>
          <p className="text-xs text-ink/50 max-w-md">
            {marketingVi.chapter04.marqueeNote}
          </p>
        </div>
      )}
    </div>
  );
}
