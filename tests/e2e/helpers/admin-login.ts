import * as fs from "node:fs";
import * as path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** Đọc mã OTP bí mật của admin từ .env.local (không in ra log). */
function adminOtp(): string {
  const env = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const code =
    env
      .match(/^DEMO_ADMIN_OTP=(.*)$/m)?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? "";
  if (code.length < 8) throw new Error("Cần DEMO_ADMIN_OTP (tối thiểu 8 ký tự) trong .env.local.");
  return code;
}

/** Đăng nhập admin qua API (cookie phiên dùng chung với trang), để test vào thẳng /admin/**. */
export async function loginAdmin(page: Page, testInfo: TestInfo) {
  const base = String(testInfo.project.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3112");
  const res = await page.request.post(`${base}/api/auth/otp/verify`, {
    data: { phone: "0900000004", code: adminOtp() },
    headers: { origin: base },
  });
  expect(res.ok(), "đăng nhập admin thất bại").toBeTruthy();
}
