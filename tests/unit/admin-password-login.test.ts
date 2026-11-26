import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Ngoài request thật không ghi được cookie; giả lập để kiểm tra logic, ghi lại vai trò được cấp.
const issued: { userId: string; role: string }[] = [];
vi.mock("@/lib/supabase/demo-session-cookie", () => ({
  setSessionCookie: async (userId: string, role: string) => {
    issued.push({ userId, role });
    return true;
  },
}));
import { POST } from "@/app/api/auth/admin/password/route";
import { normalizeHashValue } from "@/lib/admin/server/password";
import { createAdminSupabase } from "@/lib/supabase/admin";

const PASSWORD = "test-only-Strong#Pass9";
const hashFor = (password: string) => {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
};
const req = (body: unknown, ip = "10.55.0.1") =>
  new Request("http://localhost:3112/api/auth/admin/password", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3112", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

describe("đăng nhập admin bằng mật khẩu", () => {
  const saved = { demo: process.env.DEMO_MODE, hash: process.env.DEMO_ADMIN_PASSWORD_HASH };
  beforeEach(async () => {
    await createAdminSupabase().from("rate_limits").delete().like("key", "admin:password:%");
    process.env.DEMO_MODE = "true";
    process.env.DEMO_ADMIN_PASSWORD_HASH = hashFor(PASSWORD);
  });
  afterEach(() => {
    process.env.DEMO_MODE = saved.demo;
    if (saved.hash === undefined) delete process.env.DEMO_ADMIN_PASSWORD_HASH;
    else process.env.DEMO_ADMIN_PASSWORD_HASH = saved.hash;
  });

  it("tắt hoàn toàn (404) khi chưa cấu hình mã băm hoặc tắt chế độ demo", async () => {
    delete process.env.DEMO_ADMIN_PASSWORD_HASH;
    expect((await POST(req({ username: "admin", password: PASSWORD }), {})).status).toBe(404);
    process.env.DEMO_ADMIN_PASSWORD_HASH = hashFor(PASSWORD);
    process.env.DEMO_MODE = "false";
    expect((await POST(req({ username: "admin", password: PASSWORD }), {})).status).toBe(404);
  });

  it("sai mật khẩu hoặc sai tên tài khoản đều trả 401 cùng một thông báo", async () => {
    const wrongPass = await POST(req({ username: "admin", password: "nope" }), {});
    const wrongUser = await POST(req({ username: "root", password: PASSWORD }), {});
    expect(wrongPass.status).toBe(401);
    expect(wrongUser.status).toBe(401);
    expect((await wrongPass.json()).error.message).toBe((await wrongUser.json()).error.message);
  });

  it("đúng mật khẩu thì 200 và chỉ cấp vai trò quản trị", async () => {
    const res = await POST(req({ username: "admin", password: PASSWORD }), {});
    expect(res.status).toBe(200);
    expect((await res.json()).data.user.role).toBe("ADMIN_DEMO");
    expect(issued.at(-1)?.role).toBe("ADMIN_DEMO");
  });

  it("chặn dò mật khẩu: lần thứ 11 trong 5 phút từ một IP bị 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await POST(req({ username: "admin", password: `x${i}` }, "10.55.0.9"), {})).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("chấp nhận giá trị dán kèm dấu nháy, dấu cách, xuống dòng hoặc cả tên biến", async () => {
    const h = hashFor(PASSWORD);
    for (const raw of [`"${h}"`, ` ${h}\n`, `DEMO_ADMIN_PASSWORD_HASH=${h}`, `'${h}'\r\n`]) {
      expect(normalizeHashValue(raw)).toBe(h);
      process.env.DEMO_ADMIN_PASSWORD_HASH = raw;
      expect(
        (await POST(req({ username: "admin", password: PASSWORD }, `10.56.0.${raw.length}`), {})).status,
      ).toBe(200);
    }
  });
});
