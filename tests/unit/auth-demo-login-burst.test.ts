import { afterEach, describe, expect, it } from "vitest";
import { POST as otpRequest } from "@/app/api/auth/otp/request/route";
import { createAdminSupabase } from "@/lib/supabase/admin";

const req = (phone: string) =>
  new Request("http://localhost:3112/api/auth/otp/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3112",
      "x-forwarded-for": "10.7.7.7",
    },
    body: JSON.stringify({ phone }),
  });

describe("nhiều người cùng thử demo bằng số công khai không bị chặn lẫn nhau", () => {
  const saved = process.env.DEMO_MODE;
  afterEach(() => {
    process.env.DEMO_MODE = saved;
  });

  it("số demo công khai gửi mã liên tiếp 12 lần đều thành công và không lưu mã", async () => {
    process.env.DEMO_MODE = "true";
    const db = createAdminSupabase();
    const count = async () =>
      (await db.from("auth_otps").select("id", { count: "exact", head: true }).eq("phone", "0900000002"))
        .count ?? 0;
    const before = await count();
    for (let i = 0; i < 12; i++) {
      expect((await otpRequest(req("0900000002"), {})).status).toBe(200);
    }
    expect(await count()).toBe(before);
  });

  it("số thường vẫn bị giới hạn 3 lần mỗi 5 phút", async () => {
    process.env.DEMO_MODE = "true";
    const phone = `09${String(Date.now()).slice(-8)}`;
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await otpRequest(req(phone), {})).status);
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });
});
