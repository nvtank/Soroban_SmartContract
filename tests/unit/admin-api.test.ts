import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getOverview } from "@/app/api/admin/overview/route";
import { GET as getLive } from "@/app/api/admin/live/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { POST as retry } from "@/app/api/admin/onchain/[id]/retry/route";
import { ApiError } from "@/lib/api/http";
import { toAudit, toEvent, type AuditRecord } from "@/domain/admin/events";
import { overview } from "@/domain/admin/metrics";
import { maskPhone } from "@/domain/admin/read";
import { createSessionToken } from "@/lib/supabase/demo-session";
import { clearDemoSessionCookie } from "@/lib/supabase/demo-session-cookie";
import type { SessionUser } from "@/domain/dto";

const { getCookie, deleteCookie, requireUser, createAdmin, retryTx } = vi.hoisted(() => ({
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
  requireUser: vi.fn(),
  createAdmin: vi.fn(),
  retryTx: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie, delete: deleteCookie }) }));
vi.mock("@/lib/supabase/session", () => ({ requireUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: createAdmin }));
vi.mock("@/lib/stellar/outbox", () => ({
  retryOnchainTx: retryTx,
  enqueueOnchain: vi.fn(),
  flushOnchain: vi.fn(),
}));

const id = "123e4567-e89b-42d3-a456-426614174abc";
const admin: SessionUser = { id, role: "ADMIN_DEMO", fullName: null, phone: null };
const origin = "http://localhost:3121";
const at = "2026-11-25T17:30:00.000Z";

function database(tables: Record<string, Record<string, unknown>[]>) {
  const insert = vi.fn();
  const from = vi.fn((table: string) => {
    let rows = tables[table] ?? [];
    let head = false;
    let write = false;
    let single = false;
    const builder = {
      select: (_fields: string, options?: { head?: boolean }) => {
        head = Boolean(options?.head);
        return builder;
      },
      insert: (value: unknown) => {
        insert(table, value);
        write = true;
        return builder;
      },
      order: () => builder,
      eq: (field: string, value: string) => {
        rows = rows.filter((row) => row[field] === value);
        return builder;
      },
      gt: (field: string, value: string) => {
        rows = rows.filter((row) => String(row[field]) > value);
        return builder;
      },
      gte: (field: string, value: string) => {
        rows = rows.filter((row) => String(row[field]) >= value);
        return builder;
      },
      lte: (field: string, value: string) => {
        rows = rows.filter((row) => String(row[field]) <= value);
        return builder;
      },
      range: () => builder,
      limit: (limit: number) => {
        rows = rows.slice(0, limit);
        return builder;
      },
      maybeSingle: () => {
        single = true;
        return builder;
      },
      then: (resolve: (result: unknown) => void) =>
        resolve({
          data: head || write ? null : single ? (rows[0] ?? null) : rows,
          count: rows.length,
          error: null,
        }),
    };
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient, insert, from };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("SESSION_SECRET", "test-only-session-signing-key-for-admin-api");
  requireUser.mockResolvedValue(admin);
  getCookie.mockImplementation(() => ({ value: createSessionToken(id, "ADMIN_DEMO") }));
  createAdmin.mockReturnValue(database({}).client);
});

describe("admin routes", () => {
  const request = new Request(`${origin}/api/admin/overview`);

  it("returns 401 for missing sessions and never opens the admin database", async () => {
    requireUser.mockRejectedValue(new ApiError("UNAUTHENTICATED"));
    expect((await getOverview(request, {})).status).toBe(401);
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 for a tenant or an unsigned admin", async () => {
    requireUser.mockResolvedValueOnce({ ...admin, role: "TENANT" });
    expect((await getOverview(request, {})).status).toBe(403);
    getCookie.mockReturnValue({ value: "unsigned" });
    expect((await getOverview(request, {})).status).toBe(403);
  });

  it("returns the six zero-filled series to a signed admin", async () => {
    const response = await getOverview(request, {});
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { data } = await response.json();
    expect(Object.keys(data.series)).toHaveLength(6);
    for (const points of Object.values(data.series) as { value: number }[][]) {
      expect(points).toHaveLength(30);
      expect(points.every((point) => point.value === 0)).toBe(true);
    }
  });

  it("filters live events strictly after since, independently of the 60-minute series", async () => {
    const timestamp = new Date();
    const before = new Date(timestamp.getTime() - 20_000).toISOString();
    const since = new Date(timestamp.getTime() - 10_000).toISOString();
    const after = new Date(timestamp.getTime() - 5_000).toISOString();
    createAdmin.mockReturnValue(
      database({
        audit_logs: [before, since, after].map((created_at, index) => ({
          id: `event-${index}`,
          created_at,
          actor_id: id,
          action: "LOGIN",
          entity: "profiles",
          entity_id: id,
        })),
      }).client,
    );
    const response = await getLive(new Request(`${origin}/api/admin/live?since=${since}`), {});
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.events.map((event: { at: string }) => event.at)).toEqual([after]);
    expect(data.activeSeries).toHaveLength(60);
    expect(data.eventSeries).toHaveLength(60);
    expect(data.eventSeries.reduce((sum: number, point: { value: number }) => sum + point.value, 0)).toBe(3);
    expect((await getLive(new Request(`${origin}/api/admin/live?since=invalid`), {})).status).toBe(400);
  });

  it("projects masked contact data and excludes private fields", async () => {
    createAdmin.mockReturnValue(
      database({
        profiles: [
          {
            id,
            phone: "0901234567",
            full_name: "Trần Bình 0901234567",
            created_at: at,
            role: "TENANT",
            landlord: [],
            tenant: [],
            passkeys: [],
            wallet: { stellar_public_key: "S" + "A".repeat(55) },
            encrypted_secret: "private",
            cccd: "1234567890",
            SESSION_SECRET: "private",
          },
        ],
      }).client,
    );
    const response = await getUsers(new Request(`${origin}/api/admin/users`), {});
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("090***4567");
    expect(body).not.toMatch(/\d{10}|secret|encrypted|SESSION/i);
    expect(maskPhone("+84 901 234 567")).toBe("849***4567");
  });

  it("blocks cross-origin POSTs and retry on every non-failed status", async () => {
    const context = { params: Promise.resolve({ id }) };
    const url = `${origin}/api/admin/onchain/${id}/retry`;
    expect(
      (await retry(new Request(url, { method: "POST", headers: { origin: "https://other.test" } }), context))
        .status,
    ).toBe(403);
    for (const status of ["PENDING", "SUBMITTED", "CONFIRMED"]) {
      createAdmin.mockReturnValue(database({ onchain_txs: [{ id, status }] }).client);
      expect((await retry(new Request(url, { method: "POST" }), context)).status).toBe(409);
    }
    expect(retryTx).not.toHaveBeenCalled();
  });

  it("reuses the retry service for a failed transaction and records the actor", async () => {
    const row = {
      id,
      status: "FAILED",
      contract_id: id,
      action: "create_contract",
      created_at: at,
      updated_at: at,
      retry_count: 0,
    };
    const db = database({ onchain_txs: [row] });
    createAdmin.mockReturnValue(db.client);
    retryTx.mockImplementation(async () => {
      row.status = "PENDING";
    });
    const response = await retry(new Request(`${origin}/api/admin/onchain/${id}/retry`, { method: "POST" }), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("PENDING");
    expect(retryTx).toHaveBeenCalledWith(db.client, id);
    expect(db.insert).toHaveBeenCalledWith(
      "audit_logs",
      expect.objectContaining({ action: "ADMIN_RETRY_ONCHAIN", actor_id: id }),
    );
  });
});

it("maps real business actions and projects safe event and audit details", () => {
  const row: AuditRecord = {
    id,
    created_at: at,
    actor_id: id,
    action: "RENT_DUE_EXTENDED",
    entity: "rent_periods",
    entity_id: `${id}:2`,
    meta: { paymentId: "SESSION_SECRET" },
    actor: { role: "TENANT", full_name: "Trần Thị Bình" },
  };
  expect(toEvent(row)).toMatchObject({
    action: "DUE_EXTENDED",
    actorLabel: "Trần T. Bình",
    target: { type: "contract", id },
  });
  expect(toAudit(row)).toMatchObject({ action: "RENT_DUE_EXTENDED", detail: "Gia hạn kỳ thanh toán" });
  expect(
    JSON.stringify(toAudit({ ...row, action: "secret", entity: "encrypted", entity_id: "0901234567" })),
  ).not.toMatch(/\d{10}|secret|encrypted|SESSION/i);
});

it("clears the signed cookie and records logout without exposing the token", async () => {
  const db = database({});
  createAdmin.mockReturnValue(db.client);
  await clearDemoSessionCookie();
  expect(deleteCookie).toHaveBeenCalledWith("rentflow_session");
  expect(db.insert).toHaveBeenCalledExactlyOnceWith("audit_logs", {
    action: "LOGOUT",
    actor_id: id,
    entity: "profiles",
    entity_id: id,
  });
});

it("preserves exact money and computes success rate from terminal transactions within 30 days", async () => {
  const { client } = database({
    deposits: [
      { status: "RECORDED", paid_amount: "9007199254740993" },
      { status: "PENDING_DISPUTE", paid_amount: "9" },
      { status: "PENDING_REFUND", paid_amount: "1" },
      { status: "REFUNDED", paid_amount: "99" },
    ],
    onchain_txs: [
      { status: "CONFIRMED", updated_at: at },
      { status: "FAILED", updated_at: at },
      { status: "PENDING", updated_at: at },
      { status: "FAILED", updated_at: "2026-10-10T10:00:00Z" },
    ],
  });
  const result = await overview(client, new Date(at));
  expect(result.kpis.deposits.heldAmount).toBe("9007199254741003");
  expect(result.kpis.onchain.successRate).toBe(0.5);
  expect(result.series.onchainFailed.at(-1)).toEqual({ date: "2026-11-26", value: 1 });
});
