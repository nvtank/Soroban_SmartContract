import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as otpRequest } from "@/app/api/auth/otp/request/route";
import { POST as otpVerify } from "@/app/api/auth/otp/verify/route";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/demo/auth";

const ADMIN = "0900000004";
const post = (path: string, body: unknown) =>
  new Request(`http://localhost:3112${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3112",
      "x-forwarded-for": "10.9.9.9",
    },
    body: JSON.stringify(body),
  });

describe("admin demo OTP is a private secret, not the public demo code", () => {
  const saved = { demo: process.env.DEMO_MODE, otp: process.env.DEMO_ADMIN_OTP };
  beforeEach(async () => {
    await createAdminSupabase().from("rate_limits").delete().like("key", "otp:%");
  });
  afterEach(() => {
    process.env.DEMO_MODE = saved.demo;
    if (saved.otp === undefined) delete process.env.DEMO_ADMIN_OTP;
    else process.env.DEMO_ADMIN_OTP = saved.otp;
  });

  it("rejects the public demo code for the admin number", async () => {
    process.env.DEMO_MODE = "true";
    process.env.DEMO_ADMIN_OTP = "s3cret-otp-8";
    const res = await otpVerify(post("/api/auth/otp/verify", { phone: ADMIN, code: "123456" }), {});
    expect(res.status).toBe(400);
  });

  it("rejects every code when no admin OTP is configured", async () => {
    process.env.DEMO_MODE = "true";
    delete process.env.DEMO_ADMIN_OTP;
    for (const code of ["123456", "", "undefined", "00000000"]) {
      const res = await otpVerify(
        post("/api/auth/otp/verify", { phone: ADMIN, code: code.padEnd(4, "0") }),
        {},
      );
      expect(res.status).toBe(400);
    }
  });

  it("rejects a wrong admin code and never sets a session cookie", async () => {
    process.env.DEMO_MODE = "true";
    process.env.DEMO_ADMIN_OTP = "s3cret-otp-8";
    const res = await otpVerify(post("/api/auth/otp/verify", { phone: ADMIN, code: "s3cret-otp-9" }), {});
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("rentflow_session");
  });

  it("does not issue or reveal a code for the admin number via the request route", async () => {
    process.env.DEMO_MODE = "true";
    const res = await otpRequest(post("/api/auth/otp/request", { phone: ADMIN }), {});
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain("123456");
    const { data } = await createAdminSupabase().from("auth_otps").select("id").eq("phone", ADMIN);
    expect(data ?? []).toHaveLength(0);
  });

  it("safeEqual refuses empty or short secrets and compares exactly", () => {
    expect(safeEqual("", "", 8)).toBe(false);
    expect(safeEqual("abc", "abc", 8)).toBe(false);
    expect(safeEqual("longenough1", "longenough1", 8)).toBe(true);
    expect(safeEqual("longenough1", "longenough2", 8)).toBe(false);
    expect(safeEqual("longenough", "longenough1", 8)).toBe(false);
  });
});
