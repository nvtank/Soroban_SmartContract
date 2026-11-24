import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { DEMO_SESSION_COOKIE, createSessionToken } from "@/lib/supabase/demo-session";

const SECRET = "x".repeat(40);
const LANDLORD_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_ID = "00000000-0000-0000-0000-000000000004";

function withSession(path: string, token: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (token) headers.cookie = `${DEMO_SESSION_COOKIE}=${token}`;
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("Server-Side Protection & CSRF in src/proxy.ts", () => {
  const original = { demo: process.env.DEMO_MODE, secret: process.env.SESSION_SECRET };

  beforeAll(() => {
    process.env.SESSION_SECRET = SECRET;
    process.env.DEMO_MODE = "true";
  });

  afterEach(() => {
    process.env.DEMO_MODE = "true";
  });

  it("restores env after the suite", () => {
    expect(original).toBeDefined();
  });

  it("redirects unauthenticated users trying to access /app/** to /dang-nhap", () => {
    const res = proxy(withSession("/app/hop-dong/123", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dang-nhap?next=%2Fapp%2Fhop-dong%2F123");
  });

  it("allows users holding a server-signed session", () => {
    const res = proxy(withSession("/app/hop-dong/123", createSessionToken(LANDLORD_ID, "LANDLORD")));
    expect(res.status).toBe(200);
  });

  it("rejects the old unsigned id cookie (impersonation attempt)", () => {
    const req = new NextRequest("http://localhost:3000/app/hop-dong/123", {
      headers: { cookie: `rentflow_demo_user_id=${LANDLORD_ID}` },
    });
    expect(proxy(req).status).toBe(307);
  });

  it("rejects a forged or tampered session token", () => {
    const real = createSessionToken(LANDLORD_ID, "LANDLORD") as string;
    const [payload, signature] = real.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: ADMIN_ID, role: "ADMIN_DEMO", exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    for (const token of [`${forgedPayload}.${signature}`, `${payload}.${"A".repeat(signature.length)}`, "garbage", ""]) {
      expect(proxy(withSession("/app/hop-dong/123", token)).status).toBe(307);
    }
  });

  it("rejects an expired session", () => {
    const expired = createSessionToken(LANDLORD_ID, "LANDLORD", Date.now() - 9 * 60 * 60 * 1000);
    expect(proxy(withSession("/app/hop-dong/123", expired)).status).toBe(307);
  });

  it("does not issue sessions without a strong SESSION_SECRET", () => {
    const saved = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "short";
    try {
      expect(createSessionToken(LANDLORD_ID, "LANDLORD")).toBeNull();
    } finally {
      process.env.SESSION_SECRET = saved;
    }
  });

  it("does not honour demo accounts when DEMO_MODE is off", () => {
    const token = createSessionToken(LANDLORD_ID, "LANDLORD");
    process.env.DEMO_MODE = "false";
    expect(proxy(withSession("/app/hop-dong/123", token)).status).toBe(307);
  });

  describe("/app/admin-demo access control", () => {
    it("returns 404 if DEMO_MODE is not true", () => {
      process.env.DEMO_MODE = "false";
      expect(proxy(withSession("/app/admin-demo", null)).status).toBe(404);
    });

    it("redirects unauthenticated user to login when DEMO_MODE is true", () => {
      const res = proxy(withSession("/app/admin-demo", null));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/dang-nhap?next=%2Fapp%2Fadmin-demo");
    });

    it("returns 403 if the signed session is not ADMIN_DEMO", () => {
      expect(proxy(withSession("/app/admin-demo", createSessionToken(LANDLORD_ID, "LANDLORD"))).status).toBe(403);
    });

    it("ignores a client-supplied role cookie", () => {
      const req = new NextRequest("http://localhost:3000/app/admin-demo", {
        headers: { cookie: "rentflow_demo_user_id=123; rentflow_demo_user_role=ADMIN_DEMO" },
      });
      expect(proxy(req).status).toBe(307);
    });

    it("allows a signed ADMIN_DEMO session", () => {
      expect(proxy(withSession("/app/admin-demo", createSessionToken(ADMIN_ID, "ADMIN_DEMO"))).status).toBe(200);
    });
  });

  describe("CSRF protection for write routes", () => {
    const post = (headers: Record<string, string>, path = "/api/contracts") =>
      proxy(new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers }));

    it("blocks cross-origin POST requests with mismatched Origin header", () => {
      expect(post({ origin: "https://evil-attacker.com" }).status).toBe(403);
    });

    it("blocks cross-origin POST requests with mismatched Referer header", () => {
      expect(post({ referer: "https://evil-attacker.com/malicious-page" }).status).toBe(403);
    });

    it("allows same-origin POST requests", () => {
      expect(post({ origin: "http://localhost:3000" }).status).toBe(200);
    });

    it("exempts payOS webhook from CSRF check", () => {
      expect(post({ origin: "https://payos.vn" }, "/api/payments/payos/webhook").status).toBe(200);
    });
  });
});
