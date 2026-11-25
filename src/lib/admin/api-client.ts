/**
 * Bộ gọi API admin phía giao diện. Mọi trang admin chỉ lấy dữ liệu qua đây.
 * Khi NEXT_PUBLIC_ADMIN_FIXTURES=1 thì trả dữ liệu mẫu (src/lib/admin/fixtures.ts) để dựng giao diện
 * trước khi API thật sẵn sàng. Không bao giờ bật cờ này trên môi trường thật.
 */
import type {
  AdminAuditRow,
  AdminContractDetailDto,
  AdminContractRow,
  AdminHealthDto,
  AdminLiveDto,
  AdminOnchainRow,
  AdminOverviewDto,
  AdminPaymentRow,
  AdminRecoveryRow,
  AdminUserDetailDto,
  AdminUserRow,
  ListQuery,
  Page,
} from "@/domain/admin/dto";

const USE_FIXTURES = process.env.NEXT_PUBLIC_ADMIN_FIXTURES === "1";

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!res.ok) throw new AdminApiError(res.status, json?.error?.message ?? `Lỗi ${res.status}`);
  return json?.data as T;
}

function qs(q: ListQuery | Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Chế độ dữ liệu mẫu: nạp fixtures khi cần (không vào bundle khi tắt cờ), giả độ trễ mạng nhỏ. */
async function fx<T>(make: (f: (typeof import("./fixtures"))["fixtures"]) => T): Promise<T> {
  const { fixtures } = await import("./fixtures");
  await new Promise((r) => setTimeout(r, 250));
  return make(fixtures);
}

export const adminApi = {
  overview: (): Promise<AdminOverviewDto> =>
    USE_FIXTURES ? fx((f) => f.overview()) : call("/api/admin/overview"),
  live: (since?: string): Promise<AdminLiveDto> =>
    USE_FIXTURES ? fx((f) => f.live(since)) : call(`/api/admin/live${qs({ since })}`),
  users: (q: ListQuery = {}): Promise<Page<AdminUserRow>> =>
    USE_FIXTURES ? fx((f) => f.users(q)) : call(`/api/admin/users${qs(q)}`),
  user: (id: string): Promise<AdminUserDetailDto> =>
    USE_FIXTURES ? fx((f) => f.user(id)) : call(`/api/admin/users/${id}`),
  contracts: (q: ListQuery = {}): Promise<Page<AdminContractRow>> =>
    USE_FIXTURES ? fx((f) => f.contracts(q)) : call(`/api/admin/contracts${qs(q)}`),
  contract: (id: string): Promise<AdminContractDetailDto> =>
    USE_FIXTURES ? fx((f) => f.contract(id)) : call(`/api/admin/contracts/${id}`),
  payments: (q: ListQuery = {}): Promise<Page<AdminPaymentRow>> =>
    USE_FIXTURES ? fx((f) => f.payments(q)) : call(`/api/admin/payments${qs(q)}`),
  onchain: (q: ListQuery = {}): Promise<Page<AdminOnchainRow>> =>
    USE_FIXTURES ? fx((f) => f.onchain(q)) : call(`/api/admin/onchain${qs(q)}`),
  retryOnchain: (id: string): Promise<AdminOnchainRow> =>
    USE_FIXTURES
      ? fx((f) => ({ ...f.onchain({}).items[0], id, status: "PENDING" as const }))
      : call(`/api/admin/onchain/${id}/retry`, { method: "POST", body: "{}" }),
  audit: (q: ListQuery = {}): Promise<Page<AdminAuditRow>> =>
    USE_FIXTURES ? fx((f) => f.audit(q)) : call(`/api/admin/audit${qs(q)}`),
  recovery: (): Promise<AdminRecoveryRow[]> =>
    USE_FIXTURES ? fx((f) => f.recovery()) : call("/api/admin/recovery"),
  approveRecovery: (id: string): Promise<{ ok: true }> =>
    USE_FIXTURES
      ? fx(() => ({ ok: true as const }))
      : call(`/api/admin/recovery/${id}/approve`, { method: "POST", body: "{}" }),
  health: (): Promise<AdminHealthDto> => (USE_FIXTURES ? fx((f) => f.health()) : call("/api/admin/health")),
  runOverdueScan: (): Promise<unknown> =>
    USE_FIXTURES
      ? fx(() => ({ ok: true }))
      : call("/api/admin/jobs/overdue-scan", { method: "POST", body: "{}" }),
  flushOnchain: (): Promise<unknown> =>
    USE_FIXTURES
      ? fx(() => ({ ok: true }))
      : call("/api/admin/jobs/flush-onchain", { method: "POST", body: "{}" }),
};

/** Định dạng tiền VND: "9.000.000 đ". */
export function formatVnd(amount: string | number): string {
  return `${Number(amount).toLocaleString("vi-VN")} đ`;
}
