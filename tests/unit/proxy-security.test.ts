import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("Server-Side Protection & CSRF in src/proxy.ts", () => {
  const originalDemoMode = process.env.DEMO_MODE;

  it("redirects unauthenticated users trying to access /app/** to /dang-nhap", () => {
    const req = new NextRequest("http://localhost:3000/app/hop-dong/123");
    const res = proxy(req);

    expect(res.status).toBe(307); // redirect
    expect(res.headers.get("location")).toBe("http://localhost:3000/dang-nhap?next=%2Fapp%2Fhop-dong%2F123");
  });

  it("allows authenticated users to access /app/**", () => {
    const req = new NextRequest("http://localhost:3000/app/hop-dong/123", {
      headers: {
        cookie: "rentflow_demo_user_id=00000000-0000-0000-0000-000000000001",
      },
    });
    const res = proxy(req);

    expect(res.status).toBe(200);
  });

  describe("/app/admin-demo access control", () => {
    it("returns 404 if DEMO_MODE is not true", () => {
      process.env.DEMO_MODE = "false";
      try {
        const req = new NextRequest("http://localhost:3000/app/admin-demo");
        const res = proxy(req);
        expect(res.status).toBe(404);
      } finally {
        process.env.DEMO_MODE = originalDemoMode;
      }
    });

    it("redirects unauthenticated user to login when DEMO_MODE is true", () => {
      process.env.DEMO_MODE = "true";
      try {
        const req = new NextRequest("http://localhost:3000/app/admin-demo");
        const res = proxy(req);
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe("http://localhost:3000/dang-nhap?next=%2Fapp%2Fadmin-demo");
      } finally {
        process.env.DEMO_MODE = originalDemoMode;
      }
    });

    it("returns 403 if authenticated user is not ADMIN_DEMO", () => {
      process.env.DEMO_MODE = "true";
      try {
        const req = new NextRequest("http://localhost:3000/app/admin-demo", {
          headers: {
            cookie: "rentflow_demo_user_id=123; rentflow_demo_user_role=TENANT",
          },
        });
        const res = proxy(req);
        expect(res.status).toBe(403);
      } finally {
        process.env.DEMO_MODE = originalDemoMode;
      }
    });

    it("allows user with ADMIN_DEMO role to access /app/admin-demo when DEMO_MODE is true", () => {
      process.env.DEMO_MODE = "true";
      try {
        const req = new NextRequest("http://localhost:3000/app/admin-demo", {
          headers: {
            cookie: "rentflow_demo_user_id=123; rentflow_demo_user_role=ADMIN_DEMO",
          },
        });
        const res = proxy(req);
        expect(res.status).toBe(200);
      } finally {
        process.env.DEMO_MODE = originalDemoMode;
      }
    });
  });

  describe("CSRF protection for write routes", () => {
    it("blocks cross-origin POST requests with mismatched Origin header", () => {
      const req = new NextRequest("http://localhost:3000/api/contracts", {
        method: "POST",
        headers: {
          origin: "https://evil-attacker.com",
        },
      });
      const res = proxy(req);

      expect(res.status).toBe(403);
    });

    it("blocks cross-origin POST requests with mismatched Referer header", () => {
      const req = new NextRequest("http://localhost:3000/api/contracts", {
        method: "POST",
        headers: {
          referer: "https://evil-attacker.com/malicious-page",
        },
      });
      const res = proxy(req);

      expect(res.status).toBe(403);
    });

    it("allows same-origin POST requests", () => {
      const req = new NextRequest("http://localhost:3000/api/contracts", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
        },
      });
      const res = proxy(req);

      expect(res.status).toBe(200);
    });

    it("exempts payOS webhook from CSRF check", () => {
      const req = new NextRequest("http://localhost:3000/api/payments/payos/webhook", {
        method: "POST",
        headers: {
          origin: "https://payos.vn",
        },
      });
      const res = proxy(req);

      expect(res.status).toBe(200);
    });
  });
});
