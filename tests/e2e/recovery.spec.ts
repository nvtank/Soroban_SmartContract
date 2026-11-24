import { expect, request, test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TENANT1 = "0900000002";

/** Đọc một biến từ .env.local (chỉ dùng cho môi trường local). */
function envLocal(name: string): string {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const match = content.match(new RegExp(`^${name}=(.*)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

/**
 * Giới hạn "3 yêu cầu khôi phục mỗi 10 phút theo số điện thoại" là tính năng chống lạm dụng và hoạt động đúng,
 * nên test chạy lặp sẽ tự hết hạn mức. Dọn hạn mức trước mỗi lần chạy. Chỉ chạy với database local.
 */
async function resetRecoveryRateLimit() {
  const url = envLocal("NEXT_PUBLIC_SUPABASE_URL");
  const key = envLocal("SUPABASE_SERVICE_ROLE_KEY");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url) || !key) return;
  await createClient(url, key).from("rate_limits").delete().like("key", "rec:req:%");
}

async function loginViaUi(page: Page, phone: string) {
  await page.goto("/dang-nhap");
  const quickBtn = page.locator("button", { hasText: phone }).first();
  if (await quickBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await quickBtn.click();
    await expect(page).toHaveURL(/\/app/);
    return;
  }
  await page.getByRole("textbox").first().fill(phone);
  await page
    .getByRole("button", { name: /OTP|Tiếp tục|Gửi/i })
    .first()
    .click();
  const otpInput = page.locator('input[placeholder="123456"]');
  await expect(otpInput).toBeVisible();
  await otpInput.fill("123456");
  await page.getByRole("button", { name: "Xác nhận & Vào ứng dụng" }).click();
  await expect(page).toHaveURL(/\/app/);
}

test.describe("E2E: Khôi phục tài khoản (/app/khoi-phuc)", () => {
  test("khách vãng lai vào /app/khoi-phuc bị route guard chuyển hướng về /dang-nhap", async ({ page }) => {
    await page.goto("/app/khoi-phuc");
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Đăng nhập tài khoản");
  });

  test("người dùng đã đăng nhập có thể thực hiện quy trình khôi phục 4 bước", async ({ page }) => {
    await resetRecoveryRateLimit();
    await loginViaUi(page, TENANT1);
    await page.goto("/app/khoi-phuc");

    // Tiêu đề trang
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Khôi phục tài khoản");
    await expect(page.getByText("MÔ PHỎNG").first()).toBeVisible();

    // Bước 1: Nhập số điện thoại
    await expect(page.getByRole("heading", { name: /1\. Nhập số điện thoại/ })).toBeVisible();
    await page.locator('input[type="tel"]').fill("0900000002");
    await page.getByRole("button", { name: /Gửi mã xác thực OTP/i }).click();

    // Bước 2: Nhập OTP
    await expect(page.getByRole("heading", { name: /2\. Xác thực mã OTP/ })).toBeVisible();
    const otpInput = page.getByRole("textbox");
    await expect(otpInput).toBeVisible();
    await otpInput.fill("123456");
    await page.getByRole("button", { name: /Xác nhận OTP/i }).click();

    // Bước 3: eKYC mô phỏng
    await expect(page.getByRole("heading", { name: /3\. Xác thực danh tính điện tử eKYC/ })).toBeVisible();
    await expect(page.getByText("Chụp mặt trước CCCD")).toBeVisible();
    await expect(page.getByText("Quét khuôn mặt sinh trắc học")).toBeVisible();
    await page.getByRole("button", { name: /Hoàn tất xác thực eKYC mô phỏng/i }).click();

    // Bước 4: yêu cầu thật đã được ghi nhận và CHỜ quản trị duyệt (không tự cấp Passkey)
    await expect(page.getByRole("heading", { name: /đang chờ Ban Quản trị duyệt/i })).toBeVisible();
    await expect(page.getByText(/Đang chờ duyệt \(PENDING\)/)).toBeVisible();

    // Quản trị viên duyệt qua API thật bằng phiên ADMIN_DEMO (OTP bí mật lấy từ .env.local, không in ra)
    const adminOtp = envLocal("DEMO_ADMIN_OTP");
    test.skip(!adminOtp, "Thiếu DEMO_ADMIN_OTP trong .env.local nên không duyệt được yêu cầu khôi phục.");
    const origin = new URL(page.url()).origin;
    const admin = await request.newContext({ baseURL: origin, extraHTTPHeaders: { origin } });
    const login = await admin.post("/api/auth/otp/verify", { data: { phone: "0900000004", code: adminOtp } });
    expect(login.ok()).toBeTruthy();
    const pending = await admin.get("/api/recovery");
    const rows = (await pending.json()).data as Array<{ id: string; phone?: string }>;
    expect(rows.length).toBeGreaterThan(0);
    const approve = await admin.post(`/api/recovery/${rows[0].id}/approve`, { data: {} });
    expect(approve.ok()).toBeTruthy();
    await admin.dispose();

    // Người dùng bấm "Kiểm tra lại" và thấy yêu cầu đã được duyệt; việc cấp Passkey thật cần thiết bị Passkey
    // (đã kiểm thử riêng bằng thiết bị Passkey ảo ở luồng đăng ký Passkey)
    await page.getByRole("button", { name: /Kiểm tra lại trạng thái/i }).click();
    await expect(page.getByRole("heading", { name: /đã được phê duyệt/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Thiết lập Passkey mới/i })).toBeVisible();
  });
});
