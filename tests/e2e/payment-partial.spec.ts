import { expect, test, type Locator, type Page } from "@playwright/test";

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

test.describe("E2E: Thanh toán thiếu rồi nộp đủ", () => {
  test("người thuê nộp thiếu rồi nộp đủ ở màn hình thanh toán", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await openContract(page, "Phòng 301");
    await page.getByRole("button", { name: /Tiền thuê/ }).first().click();

    // Tìm nút Nộp tiền đầu tiên còn hoạt động
    const payBtn = page.getByRole("button", { name: "Nộp tiền" }).first();
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Thanh toán qua VietQR")).toBeVisible();

    // 1. Giả lập nộp thiếu tiền
    const underpaidBtn = dialog.getByRole("button", { name: "Giả lập: Nộp thiếu tiền" });
    await expect(underpaidBtn).toBeVisible();
    await underpaidBtn.click();

    // Nhãn trạng thái nộp thiếu phải hiển thị đúng
    await expect(dialog.getByText(/Nộp thiếu tiền|Nộp thiếu \(UNDERPAID\)/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // 2. Giả lập nộp đủ tiền
    const fullPayBtn = dialog.getByRole("button", { name: "Giả lập: Đã nhận đủ tiền" });
    await expect(fullPayBtn).toBeVisible();
    await fullPayBtn.click();

    // Nhãn trạng thái nộp đủ thành công phải hiển thị đúng
    await expect(dialog.getByText(/Giao dịch đã xác nhận thành công|Thanh toán thành công/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
