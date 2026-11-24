import React from "react";

export interface OnchainStampProps {
  className?: string;
  timestamp?: string;
}

export function OnchainStamp({ className = "", timestamp }: OnchainStampProps) {
  return (
    <div
      className={`inline-block border-2 border-primary/80 text-primary px-3 py-1.5 rounded-lg font-extrabold uppercase tracking-widest text-xs sm:text-sm select-none transform -rotate-3 shadow-xs bg-paper ${className}`}
      style={{
        boxShadow: "0 0 0 2px rgba(15, 139, 109, 0.2)",
      }}
      role="img"
      aria-label="Con dấu: ĐÃ GHI NHẬN ON-CHAIN"
    >
      <div className="flex items-center gap-1.5 border-b border-primary/30 pb-0.5">
        <span className="text-base leading-none">✓</span>
        <span>ĐÃ GHI NHẬN ON-CHAIN</span>
      </div>
      <div className="text-[10px] tracking-normal font-mono text-center pt-0.5 text-primary/80 lowercase">
        Stellar Testnet • {timestamp ? new Date(timestamp).toLocaleDateString("vi-VN") : "Bảo chứng"}
      </div>
    </div>
  );
}
