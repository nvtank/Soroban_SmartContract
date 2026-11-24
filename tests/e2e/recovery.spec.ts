import { expect, test, type Page } from "@playwright/test";

const TENANT1 = "0900000002";

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
    await page.getByRole("button", { name: /Gửi yêu cầu khôi phục tới Admin/i }).click();

    // Bước 4: Tiếp nhận & Cấp lại Passkey mô phỏng
    await expect(page.getByRole("heading", { name: /Yêu cầu khôi phục đã được tiếp nhận/ })).toBeVisible();
    const resetPasskeyBtn = page.getByRole("button", { name: /Thiết lập Passkey mới/i });
    await expect(resetPasskeyBtn).toBeVisible();
    await resetPasskeyBtn.click();
    await expect(page.getByText(/Đã cấp và kích hoạt Passkey mới thành công/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
