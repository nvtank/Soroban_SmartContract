import type { SortState } from "@/components/admin/table";

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Chưa ghi nhận";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "Chưa ghi nhận";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} tháng trước`;
  return `${Math.floor(diffMonth / 12)} năm trước`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function stellarAccountUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${encodeURIComponent(publicKey)}`;
}

export function stellarTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(txHash)}`;
}

/**
 * Đảm bảo không bao giờ hiển thị số điện thoại 10 chữ số liền kề trên giao diện admin.
 */
export function maskPhoneSafety(phone: string | null | undefined): string {
  if (!phone) return "—";
  return phone.replace(/\b(\d{3})\d{3,4}(\d{3,4})\b/g, "$1***$2");
}

export function sortRows<T>(
  rows: T[],
  sort: SortState | null,
  getters: Record<string, (row: T) => string | number | null | undefined>,
): T[] {
  if (!sort) return rows;
  const getter = getters[sort.key];
  if (!getter) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * dir;
    }
    return String(va).localeCompare(String(vb), "vi") * dir;
  });
}
