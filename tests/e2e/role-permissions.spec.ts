import { expect, test, type Locator, type Page } from "@playwright/test";

const LANDLORD = "0900000001";
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

async function openContract(page: Page, room: string) {
  await page.goto("/app");
  const link: Locator = page
    .locator("div", { hasText: room })
    .filter({ has: page.locator('a:has-text("Xem chi tiết")') })
    .last()
    .locator('a:has-text("Xem chi tiết")');
  await link.click();
  await expect(page).toHaveURL(/\/app\/hop-dong\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(room);
}

test.describe("E2E: Phân quyền vai trò trên giao diện", () => {
  test("chủ nhà thấy nút quản lý hợp đồng nhưng không thấy nút nộp tiền của người thuê", async ({ page }) => {
    await loginViaUi(page, LANDLORD);
    await page.goto("/app");

    // Chủ nhà thấy nút tạo hợp đồng trên header và banner
    await expect(page.locator('a[href="/app/hop-dong/moi"]').first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Tạo hợp đồng/i }).first()).toBeVisible();

    // Mở hợp đồng Phòng 301
    await openContract(page, "Phòng 301");

    // Tab Tiền thuê: chủ nhà KHÔNG thấy nút "Nộp tiền"
    await page.getByRole("button", { name: /Tiền thuê/ }).first().click();
    await expect(page.getByRole("button", { name: "Nộp tiền" })).toHaveCount(0);

    // Tab Hoàn cọc & Tranh chấp: chủ nhà thấy phần Đề xuất khấu trừ
    await page.getByRole("button", { name: /Hoàn cọc/ }).first().click();
    await expect(page.getByRole("heading", { name: /Đề xuất khấu trừ/ })).toBeVisible();
  });

  test("người thuê thấy nút nộp tiền nhưng không thấy nút tạo/sửa của chủ nhà", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await page.goto("/app");

    // Người thuê KHÔNG thấy nút tạo hợp đồng trên header hay banner
    await expect(page.locator('a[href="/app/hop-dong/moi"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Tạo hợp đồng/i })).toHaveCount(0);

    // Mở hợp đồng Phòng 301
    await openContract(page, "Phòng 301");

    // Tab Tiền thuê: người thuê THẤY nút "Nộp tiền" và KHÔNG thấy "Gia hạn thanh toán"
    await page.getByRole("button", { name: /Tiền thuê/ }).first().click();
    await expect(page.getByRole("button", { name: "Nộp tiền" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Gia hạn thanh toán" })).toHaveCount(0);

    // Tab Hoàn cọc & Tranh chấp: người thuê KHÔNG thấy form gửi đề xuất khấu trừ
    await page.getByRole("button", { name: /Hoàn cọc/ }).first().click();
    await expect(page.getByRole("button", { name: "Gửi đề xuất khấu trừ" })).toHaveCount(0);
  });
});
