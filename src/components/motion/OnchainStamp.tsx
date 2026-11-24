"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export type OnchainStampProps = {
  text?: string;
  subText?: string;
  txHash?: string | null;
  className?: string;
  interactive?: boolean;
};

export function OnchainStamp({
  text = "ĐÃ GHI NHẬN ON-CHAIN",
  subText = "STELLAR TESTNET • SOROBAN",
  txHash,
  className = "",
  interactive = true,
}: OnchainStampProps) {
  const [isStamped, setIsStamped] = useState(true);

  const reStamp = () => {
    if (!interactive) return;
    setIsStamped(false);
    setTimeout(() => setIsStamped(true), 50);
  };

  return (
    <div className={`relative inline-block select-none ${className}`}>
      {isStamped && (
        <div
          onClick={reStamp}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          title={interactive ? "Nhấn để đóng lại con dấu" : undefined}
          className={`animate-stamp inline-flex flex-col items-center justify-center rounded-xl border-4 border-double border-primary-strong/85 bg-primary/10 px-5 py-3 text-primary-strong shadow-sm ${
            interactive ? "cursor-pointer hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary" : ""
          }`}
          style={{
            transform: "rotate(-7deg)",
          }}
          data-cursor-hover="true"
        >
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" />
            <span>{text}</span>
          </div>

          <div className="mt-0.5 border-t border-primary-strong/40 pt-0.5 text-[9px] font-mono font-bold tracking-wider opacity-85 uppercase">
            {subText}
          </div>

          {txHash && (
            <div className="mt-0.5 text-[8px] font-mono opacity-70">
              HASH: {txHash.slice(0, 10)}...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
