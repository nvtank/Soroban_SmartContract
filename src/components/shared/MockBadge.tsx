import { vi } from "@/i18n/vi";

export type MockBadgeProps = {
  label?: string;
  className?: string;
};

export function MockBadge({ label = vi.demo.mockBadge, className = "" }: MockBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-dashed border-amber-ink/40 bg-amber/15 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-amber-ink uppercase ${className}`}
      title="Tính năng này được mô phỏng trong bản demo theo mục 2 quy tắc trung thực"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-ink" />
      <span>{label}</span>
    </span>
  );
}
