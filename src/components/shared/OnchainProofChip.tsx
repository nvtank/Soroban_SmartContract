import type { OnchainTxStatus } from "@/domain/states";
import { ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export type OnchainProofChipProps = {
  status: OnchainTxStatus;
  txHash?: string | null;
  explorerUrl?: string | null;
  className?: string;
  showIcon?: boolean;
};

export function OnchainProofChip({
  status,
  txHash,
  explorerUrl,
  className = "",
  showIcon = true,
}: OnchainProofChipProps) {
  const url = explorerUrl ?? (txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null);

  const truncatedHash = txHash
    ? txHash.length > 14
      ? `${txHash.slice(0, 6)}...${txHash.slice(-6)}`
      : txHash
    : null;

  let badgeStyle = "bg-primary/10 text-primary-strong border-primary/30";
  let statusText = "ĐÃ GHI NHẬN ON-CHAIN";
  let Icon = CheckCircle2;

  if (status === "PENDING" || status === "SUBMITTED") {
    badgeStyle = "bg-amber/15 text-amber-ink border-amber/40";
    statusText = "ĐANG GHI";
    Icon = Clock;
  } else if (status === "FAILED") {
    badgeStyle = "bg-brick/15 text-brick-ink border-brick/40";
    statusText = "THẤT BẠI";
    Icon = AlertCircle;
  }

  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors ${badgeStyle} ${className}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span>{statusText}</span>
      {truncatedHash && (
        <span className="font-mono text-[0.9em] font-normal opacity-85 underline decoration-dotted underline-offset-2">
          {truncatedHash}
        </span>
      )}
      {url && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block hover:opacity-90 focus-visible:rounded-full"
        title="Mở giao dịch trên Stellar Expert Explorer"
      >
        {content}
      </a>
    );
  }

  return content;
}
