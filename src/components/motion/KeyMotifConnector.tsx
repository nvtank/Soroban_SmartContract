"use client";

import { Key, ShieldAlert, Lock, CheckCircle2, Award, Scale } from "lucide-react";

export type KeyMotifConnectorProps = {
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
};

export function KeyMotifConnector({ chapter }: KeyMotifConnectorProps) {
  return (
    <div
      className="relative flex w-full items-center justify-center py-1.5 my-1 select-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Đường nối mờ tinh tế */}
      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />

      {/* Huy hiệu biểu tượng nối chương (Motif biến chuyển theo câu chuyện) */}
      <div className="relative z-10 flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 shadow-xs text-ink/60">
        {chapter === 1 && (
          <>
            <Key className="h-3.5 w-3.5 text-primary rotate-45" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-strong">
              Niềm tin trao tay
            </span>
          </>
        )}
        {chapter === 2 && (
          <>
            <ShieldAlert className="h-3.5 w-3.5 text-brick" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brick-ink">
              Rủi ro & Đứt gãy
            </span>
          </>
        )}
        {chapter === 3 && (
          <>
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-strong">
              Két cọc 2 chìa khóa
            </span>
          </>
        )}
        {chapter === 4 && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-strong">
              Hành trình 5 bước
            </span>
          </>
        )}
        {chapter === 5 && (
          <>
            <Award className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-strong">
              Bằng chứng Testnet
            </span>
          </>
        )}
        {chapter === 6 && (
          <>
            <Scale className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-strong">
              Minh bạch tuyệt đối
            </span>
          </>
        )}
      </div>
    </div>
  );
}
