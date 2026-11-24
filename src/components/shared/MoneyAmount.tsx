export type MoneyAmountProps = {
  value: string | number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showCurrency?: boolean;
};

export function MoneyAmount({
  value,
  size = "md",
  className = "",
  showCurrency = true,
}: MoneyAmountProps) {
  let formatted = "0";
  try {
    const numeric = typeof value === "number" ? BigInt(Math.round(value)) : BigInt(value || "0");
    formatted = new Intl.NumberFormat("vi-VN").format(numeric);
  } catch {
    formatted = String(value);
  }

  const sizeClasses = {
    sm: "text-sm font-bold",
    md: "text-base sm:text-lg font-extrabold tracking-tight",
    lg: "text-2xl sm:text-3xl font-extrabold tracking-tight",
    xl: "text-3xl sm:text-4xl font-black tracking-tight",
  };

  return (
    <span className={`tabular inline-flex items-baseline gap-1 text-ink ${sizeClasses[size]} ${className}`}>
      <span>{formatted}</span>
      {showCurrency && <span className="text-[0.72em] font-semibold text-ink/60">đ</span>}
    </span>
  );
}
