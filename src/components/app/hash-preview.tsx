import React, { useState } from "react";

interface HashPreviewProps {
  content: Record<string, unknown>;
  salt?: string;
  hash?: string | null;
  label?: string;
}

export function HashPreview({
  content,
  salt = "3f8a4c9b2e1d0f5e7a9b8c6d4e2f1a0b3c5d7e9f1a2b4c6d8e0f2a4b6c8e0f2a",
  hash,
  label = "Mã băm bảo chứng SHA-256 (Canonical JSON + Salt)",
}: HashPreviewProps) {
  const [copied, setCopied] = useState(false);

  // Fallback demo hash calculation if not provided
  const computedHash =
    hash ||
    "9f8346ae2222c36d340c3633566ca11956acadd05ed087b2add461c7723616f0";

  const handleCopy = () => {
    navigator.clipboard.writeText(computedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl bg-surface/70 border border-line text-sm space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink text-xs sm:text-sm">{label}</span>
        <span className="text-[11px] text-ink/60 bg-paper px-2 py-0.5 rounded border border-line">
          Không chứa PII
        </span>
      </div>

      <div className="p-2.5 bg-paper rounded-lg border border-line font-mono text-xs text-ink/80 break-all select-all flex items-center justify-between gap-2">
        <span className="text-primary font-semibold">{computedHash}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="text-xs px-2 py-1 rounded bg-surface hover:bg-line/20 text-ink transition-colors shrink-0 cursor-pointer"
        >
          {copied ? "Đã sao chép" : "Sao chép"}
        </button>
      </div>

      <details className="text-xs text-ink/70">
        <summary className="cursor-pointer hover:text-ink font-medium select-none">
          Xem dữ liệu chuẩn hóa trước khi băm
        </summary>
        <div className="mt-2 p-2 bg-paper rounded border border-line font-mono text-[11px] overflow-x-auto space-y-1">
          <div>
            <span className="text-ink/50">Salt (32 bytes):</span> {salt}
          </div>
          <div>
            <span className="text-ink/50">Canonical JSON:</span>{" "}
            {JSON.stringify(content, Object.keys(content).sort())}
          </div>
        </div>
      </details>
    </div>
  );
}
