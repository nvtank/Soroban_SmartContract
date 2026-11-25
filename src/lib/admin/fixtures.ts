/**
 * Dữ liệu mẫu cho bảng điều khiển admin khi NEXT_PUBLIC_ADMIN_FIXTURES=1.
 * Chỉ dùng để dựng giao diện trước khi API thật sẵn sàng. Không bao giờ bật trên môi trường thật.
 * Sinh tất định (cùng hạt giống ra cùng dữ liệu), riêng phần trực tiếp thay đổi theo thời gian.
 */
import type {
  AdminAuditRow,
  AdminContractDetailDto,
  AdminContractRow,
  AdminEvent,
  AdminEventAction,
  AdminHealthDto,
  AdminLiveDto,
  AdminOnchainRow,
  AdminOverviewDto,
  AdminPaymentRow,
  AdminRecoveryRow,
  AdminUserDetailDto,
  AdminUserRow,
  DailyPoint,
  ListQuery,
  MinutePoint,
  Page,
} from "@/domain/admin/dto";
import {
  CONTRACT_STATUSES,
  DEPOSIT_STATUSES,
  DISPUTE_STATUSES,
  ONCHAIN_TX_STATUSES,
  PAYMENT_STATUSES,
  RENT_STATUSES,
} from "@/domain/states";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const DAY = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const FIRST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi"];
const MID = ["Văn", "Thị", "Minh", "Thu", "Quốc", "Ngọc"];
const LAST = ["An", "Bình", "Cường", "Dung", "Hà", "Khoa", "Lan", "Nam", "Phúc", "Quỳnh", "Sơn", "Trang"];
const ROOMS = ["Sunrise", "Moonlight", "Green", "Lotus", "Riverside", "Skyline", "Maple", "Harbor"];
const ACTIONS = [
  "create_contract",
  "tenant_confirm",
  "record_deposit_paid",
  "record_rent_paid",
  "mark_overdue",
  "approve_refund",
];

function series(seed: number, base: number, spread: number, trend = 0): DailyPoint[] {
  const r = rng(seed);
  const t0 = today() - 29 * DAY;
  return Array.from({ length: 30 }, (_, i) => ({
    date: iso(t0 + i * DAY).slice(0, 10),
    value: Math.max(0, Math.round(base + trend * i + (r() - 0.5) * spread)),
  }));
}

const USERS: AdminUserRow[] = (() => {
  const r = rng(7);
  return Array.from({ length: 48 }, (_, i) => {
    const role = i % 5 === 0 ? "LANDLORD" : "TENANT";
    const created = today() - Math.floor(r() * 60) * DAY;
    return {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      fullName: `${pick(r, FIRST)} ${pick(r, MID)} ${pick(r, LAST)}`,
      phoneMasked: `09${Math.floor(r() * 9)}***${String(Math.floor(r() * 9999)).padStart(4, "0")}`,
      role,
      createdAt: iso(created),
      lastActiveAt: r() > 0.2 ? iso(Date.now() - Math.floor(r() * 3 * DAY)) : null,
      contractCount: Math.floor(r() * 4),
      hasPasskey: r() > 0.6,
      walletPublicKey:
        "G" +
        Array.from({ length: 55 }, () => pick(r, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".split(""))).join(""),
    } satisfies AdminUserRow;
  });
})();

const CONTRACTS: AdminContractRow[] = (() => {
  const r = rng(11);
  const landlords = USERS.filter((u) => u.role === "LANDLORD");
  const tenants = USERS.filter((u) => u.role === "TENANT");
  return Array.from({ length: 36 }, (_, i) => {
    const total = 2 + Math.floor(r() * 8);
    return {
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      roomLabel: `Phòng ${100 + Math.floor(r() * 400)} - ${pick(r, ROOMS)}`,
      status: pick(r, CONTRACT_STATUSES),
      depositStatus: pick(r, DEPOSIT_STATUSES),
      disputeStatus: r() > 0.85 ? "IN_PROGRESS" : "NONE",
      landlordLabel: pick(r, landlords).fullName ?? "Chủ nhà",
      tenantLabel: pick(r, tenants).fullName,
      rentAmount: String((3 + Math.floor(r() * 7)) * 500_000),
      depositAmount: String((6 + Math.floor(r() * 12)) * 500_000),
      overduePeriods: r() > 0.75 ? 1 + Math.floor(r() * 2) : 0,
      onchain: { confirmed: total - (r() > 0.8 ? 1 : 0), total },
      createdAt: iso(today() - Math.floor(r() * 45) * DAY),
    } satisfies AdminContractRow;
  });
})();

const EVENT_TEXT: Partial<Record<AdminEventAction, string>> = {
  LOGIN: "đăng nhập",
  CONTRACT_CREATED: "tạo hợp đồng",
  CONTRACT_CONFIRMED: "ký xác nhận hợp đồng",
  PAYMENT_SETTLED: "thanh toán thành công (mô phỏng)",
  REFUND_REQUESTED: "yêu cầu hoàn cọc",
  DISPUTE_OPENED: "mở tranh chấp",
  ONCHAIN_CONFIRMED: "giao dịch đã xác nhận trên Stellar Testnet",
};

function makeEvent(r: () => number, at: number, n: number): AdminEvent {
  const action = pick(r, Object.keys(EVENT_TEXT) as AdminEventAction[]);
  const u = pick(r, USERS);
  const c = pick(r, CONTRACTS);
  const system = action === "ONCHAIN_CONFIRMED";
  return {
    id: `ev-${at}-${n}`,
    at: iso(at),
    action,
    actorLabel: system ? null : u.fullName,
    actorRole: system ? "SYSTEM" : u.role,
    actorId: system ? null : u.id,
    target: action === "LOGIN" ? null : { type: "contract", id: c.id, label: c.roomLabel },
    summary: `${system ? "Hệ thống" : u.fullName}: ${EVENT_TEXT[action]}${action === "LOGIN" ? "" : ` · ${c.roomLabel}`}`,
  };
}

function paginate<T>(rows: T[], q: ListQuery, match: (row: T, text: string) => boolean): Page<T> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 20));
  const filtered = q.q ? rows.filter((row) => match(row, q.q!.toLowerCase())) : rows;
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

const countBy = <K extends string>(keys: readonly K[], values: K[]) =>
  Object.fromEntries(keys.map((k) => [k, values.filter((v) => v === k).length])) as Record<K, number>;

export const fixtures = {
  overview(): AdminOverviewDto {
    return {
      kpis: {
        users: {
          total: USERS.length,
          landlords: USERS.filter((u) => u.role === "LANDLORD").length,
          tenants: USERS.filter((u) => u.role === "TENANT").length,
          newLast7d: 9,
          activeLast24h: 17,
        },
        contracts: {
          total: CONTRACTS.length,
          byStatus: countBy(
            CONTRACT_STATUSES,
            CONTRACTS.map((c) => c.status),
          ),
        },
        deposits: {
          byStatus: countBy(
            DEPOSIT_STATUSES,
            CONTRACTS.map((c) => c.depositStatus),
          ),
          heldAmount: "186000000",
        },
        rent: {
          byStatus: countBy(RENT_STATUSES, [
            "PAID",
            "PAID",
            "PAID",
            "OVERDUE",
            "AWAITING_PAYMENT",
            "NOT_DUE",
            "PARTIALLY_PAID",
          ]),
          overdueAmount: "13500000",
          collectedLast30d: "94500000",
        },
        disputes: {
          byStatus: countBy(
            DISPUTE_STATUSES,
            CONTRACTS.map((c) => c.disputeStatus),
          ),
        },
        payments: {
          byStatus: countBy(PAYMENT_STATUSES, [
            "CONFIRMED",
            "CONFIRMED",
            "CONFIRMED",
            "CONFIRMED",
            "PENDING",
            "UNDERPAID",
            "FAILED",
            "OVERPAID",
          ]),
          simulatedShare: 1,
        },
        onchain: {
          byStatus: countBy(ONCHAIN_TX_STATUSES, [
            "CONFIRMED",
            "CONFIRMED",
            "CONFIRMED",
            "CONFIRMED",
            "CONFIRMED",
            "PENDING",
            "FAILED",
          ]),
          successRate: 0.96,
        },
        recovery: { pending: 2 },
      },
      series: {
        newUsers: series(1, 3, 4, 0.08),
        newContracts: series(2, 2, 3, 0.05),
        paymentsAmount: series(3, 9_000_000, 8_000_000, 120_000),
        onchainConfirmed: series(4, 12, 10, 0.3),
        onchainFailed: series(5, 1, 2),
        logins: series(6, 20, 14, 0.4),
      },
      generatedAt: iso(Date.now()),
    };
  },

  live(since?: string): AdminLiveDto {
    const now = Date.now();
    const minute = Math.floor(now / 60_000) * 60_000;
    const r = rng(Math.floor(now / 5000));
    const mk = (seed: number, base: number): MinutePoint[] => {
      const rr = rng(seed);
      return Array.from({ length: 60 }, (_, i) => {
        const at = minute - (59 - i) * 60_000;
        const wave = Math.sin(at / 60_000 / 7) * base * 0.4;
        return {
          at: iso(at),
          value: Math.max(0, Math.round(base + wave + (rng(at / 60_000 + seed)() - 0.5) * base * 0.6)),
        };
      }).map((p, i, all) =>
        i === all.length - 1 ? { ...p, value: Math.max(0, p.value + Math.round((rr() - 0.5) * 3)) } : p,
      );
    };
    const fresh = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => makeEvent(r, now - i * 1500, i));
    const older = Array.from({ length: 20 }, (_, i) =>
      makeEvent(rng(i + 99), minute - (i + 1) * 45_000, 100 + i),
    );
    const events = [...fresh, ...older].filter((e) => !since || e.at > since).slice(0, 30);
    return {
      now: iso(now),
      activeUsers: 6 + Math.floor(r() * 9),
      activeSeries: mk(21, 8),
      eventSeries: mk(22, 14),
      events,
      queue: { pending: Math.floor(r() * 4), submitted: Math.floor(r() * 2), failed: r() > 0.8 ? 1 : 0 },
    };
  },

  users: (q: ListQuery) =>
    paginate(
      USERS.filter((u) => !q.role || u.role === q.role),
      q,
      (u, t) => (u.fullName ?? "").toLowerCase().includes(t) || u.phoneMasked.includes(t),
    ),

  user(id: string): AdminUserDetailDto {
    const u = USERS.find((x) => x.id === id) ?? USERS[0];
    const r = rng(id.length + 3);
    return {
      ...u,
      contracts: CONTRACTS.filter(
        (c) => c.landlordLabel === u.fullName || c.tenantLabel === u.fullName,
      ).slice(0, 5),
      recentEvents: Array.from({ length: 8 }, (_, i) => makeEvent(r, Date.now() - i * 3_600_000, i)),
      activityByDay: series(id.length, 3, 5),
    };
  },

  contracts: (q: ListQuery) =>
    paginate(
      CONTRACTS.filter((c) => !q.status || c.status === q.status),
      q,
      (c, t) => c.roomLabel.toLowerCase().includes(t) || c.landlordLabel.toLowerCase().includes(t),
    ),

  contract(id: string): AdminContractDetailDto {
    const c = CONTRACTS.find((x) => x.id === id) ?? CONTRACTS[0];
    return {
      ...c,
      periods: [1, 2, 3].map((n) => ({
        periodNo: n,
        dueDate: iso(today() - (3 - n) * 30 * DAY).slice(0, 10),
        amountDue: c.rentAmount,
        amountPaid: n < 3 ? c.rentAmount : "0",
        lateFee: n === 3 ? "225000" : "0",
        status: n < 3 ? "PAID" : "OVERDUE",
      })),
      payments: fixtures
        .payments({ pageSize: 4 })
        .items.map((p) => ({ ...p, contractId: c.id, roomLabel: c.roomLabel })),
      onchainTxs: fixtures
        .onchain({ pageSize: 5 })
        .items.map((t) => ({ ...t, contractId: c.id, roomLabel: c.roomLabel })),
      events: Array.from({ length: 6 }, (_, i) => makeEvent(rng(i + 40), Date.now() - i * 7_200_000, i)),
    };
  },

  payments(q: ListQuery): Page<AdminPaymentRow> {
    const r = rng(31);
    const rows: AdminPaymentRow[] = Array.from({ length: 64 }, (_, i) => {
      const c = pick(r, CONTRACTS);
      const kind = r() > 0.7 ? "DEPOSIT" : "RENT";
      const status = pick(r, PAYMENT_STATUSES);
      const amount = kind === "DEPOSIT" ? c.depositAmount : c.rentAmount;
      const created = Date.now() - Math.floor(r() * 30 * DAY);
      return {
        id: `p-${i}`,
        contractId: c.id,
        roomLabel: c.roomLabel,
        kind,
        periodNo: kind === "RENT" ? 1 + Math.floor(r() * 6) : null,
        expectedAmount: amount,
        paidAmount:
          status === "CONFIRMED" ? amount : status === "UNDERPAID" ? String(Number(amount) / 2) : "0",
        status,
        provider: "simulated",
        isSimulated: true,
        createdAt: iso(created),
        settledAt: status === "CONFIRMED" ? iso(created + 60_000) : null,
      };
    });
    return paginate(
      rows.filter((p) => !q.status || p.status === q.status),
      q,
      (p, t) => p.roomLabel.toLowerCase().includes(t),
    );
  },

  onchain(q: ListQuery): Page<AdminOnchainRow> {
    const r = rng(41);
    const rows: AdminOnchainRow[] = Array.from({ length: 80 }, (_, i) => {
      const c = pick(r, CONTRACTS);
      const status = r() > 0.9 ? "FAILED" : r() > 0.9 ? "PENDING" : "CONFIRMED";
      const hash =
        status === "CONFIRMED"
          ? Array.from({ length: 64 }, () => pick(r, "0123456789abcdef".split(""))).join("")
          : null;
      const created = Date.now() - Math.floor(r() * 20 * DAY);
      return {
        id: `tx-${i}`,
        contractId: c.id,
        roomLabel: c.roomLabel,
        action: pick(r, ACTIONS),
        status,
        txHash: hash,
        explorerUrl: hash ? `https://stellar.expert/explorer/testnet/tx/${hash}` : null,
        retryCount: status === "FAILED" ? 1 : 0,
        error: status === "FAILED" ? "Transaction execution failed on ledger" : null,
        createdAt: iso(created),
        updatedAt: iso(created + 8000),
      };
    });
    return paginate(
      rows.filter((t) => !q.status || t.status === q.status),
      q,
      (t, s) => t.action.includes(s) || (t.roomLabel ?? "").toLowerCase().includes(s),
    );
  },

  audit(q: ListQuery): Page<AdminAuditRow> {
    const rows: AdminAuditRow[] = Array.from({ length: 120 }, (_, i) => {
      const e = makeEvent(rng(i + 500), Date.now() - i * 1_800_000, i);
      return {
        id: `a-${i}`,
        at: e.at,
        actorLabel: e.actorLabel,
        actorRole: e.actorRole,
        action: e.action,
        entity: e.target?.type ?? "user",
        entityId: e.target?.id ?? e.actorId,
        detail: e.summary,
      };
    });
    return paginate(
      rows,
      q,
      (a, t) => a.action.toLowerCase().includes(t) || (a.detail ?? "").toLowerCase().includes(t),
    );
  },

  recovery(): AdminRecoveryRow[] {
    return USERS.slice(3, 5).map((u, i) => ({
      id: `rec-${i}`,
      userId: u.id,
      userLabel: u.fullName ?? "Người dùng",
      phoneMasked: u.phoneMasked,
      status: "PENDING",
      createdAt: iso(Date.now() - (i + 1) * 3_600_000),
    }));
  },

  health(): AdminHealthDto {
    return {
      checkedAt: iso(Date.now()),
      database: { ok: true, latencyMs: 38 },
      stellar: {
        rpcOk: true,
        latestLedger: 812345,
        contractOk: true,
        contractId: "CCDNF4D4HRIDYSHBEOV2IYC2XQSTD7VPSFZ4NSGCT2QVDPJ7RX4UBVXU",
        platformBalanceXlm: 9721.4,
        oracleBalanceXlm: 9984.1,
        lowBalance: false,
        error: null,
      },
      queue: { pending: 1, submitted: 0, failed: 1, oldestPendingSeconds: 42 },
      demoMode: true,
      paymentMode: "both",
    };
  },
};
