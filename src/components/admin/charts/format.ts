/**
 * Định dạng số, tiền VND và thời gian theo chuẩn Việt Nam cho biểu đồ admin.
 */

const viNumber = new Intl.NumberFormat("vi-VN");
const viDecimal1 = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatNumberVi(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return viNumber.format(Math.round(value));
}

export function formatVndVi(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0 đ";
  return `${viNumber.format(Math.round(num))} đ`;
}

/** Định dạng gọn cho trục biểu đồ (vd: 1,5 Tr; 450 N). */
export function formatCompactVi(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${viDecimal1.format(abs / 1_000_000_000)} Tỷ`;
  if (abs >= 1_000_000) return `${sign}${viDecimal1.format(abs / 1_000_000)} Tr`;
  if (abs >= 1_000) return `${sign}${viDecimal1.format(abs / 1_000)} N`;
  return `${sign}${viNumber.format(Math.round(abs))}`;
}

export function formatVndCompactVi(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0 đ";
  if (Math.abs(num) >= 1_000) return `${formatCompactVi(num)} đ`;
  return `${viNumber.format(Math.round(num))} đ`;
}

/** Tỷ lệ 0..1 -> "96,0%". */
export function formatPercentVi(ratio: number, decimals = 1): string {
  if (!Number.isFinite(ratio)) return "0%";
  const pct = ratio * 100;
  return `${pct.toLocaleString("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** "2026-11-25" -> "25/11" */
export function formatDateShortVi(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-11-25" -> "25/11/2026" */
export function formatDateFullVi(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** ISO datetime -> "21:58" */
export function formatTimeVi(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** ISO datetime -> "21:58:12" */
export function formatTimeSecondsVi(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
