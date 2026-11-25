"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { stellarAccountUrl, truncateMiddle } from "./formatters";

export type WalletAddressPillProps = {
  publicKey: string | null;
};

export function WalletAddressPill({ publicKey }: WalletAddressPillProps) {
  const [copied, setCopied] = useState(false);

  if (!publicKey) {
    return <span className="text-sm text-ink/55">Chưa có địa chỉ ví công khai</span>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Bỏ qua nếu trình duyệt chặn clipboard
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <code
        className="rounded-xl border border-line bg-surface/75 px-2.5 py-1 font-mono text-xs font-semibold text-ink"
        title={publicKey}
      >
        {truncateMiddle(publicKey, 8, 6)}
      </code>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Sao chép địa chỉ ví công khai"
        className="inline-flex items-center gap-1 rounded-xl border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink/75 transition-colors hover:bg-surface hover:text-ink"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-primary-strong" />
            <span>Đã sao chép</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Sao chép</span>
          </>
        )}
      </button>

      <a
        href={stellarAccountUrl(publicKey)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-xl border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-strong transition-colors hover:bg-primary/18"
      >
        <span>Stellar Expert</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
