import { expect, test, type Page } from "@playwright/test";

const TENANT1 = "0900000002";
const JARGON_REGEX = /\bxlm\b|\bgas\b|seed\s*phrase/i;
// Không còn dải banner trên cùng; nhãn "mô phỏng" vẫn phải xuất hiện ở nội dung hoặc footer của mỗi trang.
const SIMULATION_LABEL = /mô phỏng/i;

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

test.describe("E2E: Nhãn mô phỏng và không có thuật ngữ Web3 ngoài ngăn bằng chứng", () => {
  const allAppPages = ["/", "/dang-nhap", "/app", "/bang-chung", "/minh-bach"];

  for (const path of allAppPages) {
    test(`mọi trang (${path}) vẫn ghi rõ phần mô phỏng`, async ({ page }) => {
      if (path === "/app") {
        await loginViaUi(page, TENANT1);
      }
      await page.goto(path);
      await expect(page.locator('[role="note"]')).toHaveCount(0);
      await expect(page.locator("body")).toContainText(SIMULATION_LABEL);
    });
  }

  test("trang /app sau đăng nhập không có thuật ngữ Web3 (XLM, gas, seed phrase)", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await page.goto("/app");
    const mainText = await page.locator("main").first().innerText();
    expect(mainText).not.toMatch(JARGON_REGEX);
  });

  test("trang chi tiết hợp đồng không có thuật ngữ Web3 ngoài ngăn bằng chứng on-chain", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await page.goto("/app");

    const link = page
      .locator("div", { hasText: "Phòng 301" })
      .filter({ has: page.locator('a:has-text("Xem chi tiết")') })
      .last()
      .locator('a:has-text("Xem chi tiết")');
    await link.click();
    await expect(page).toHaveURL(/\/app\/hop-dong\//);

    // Trang chi tiết hợp đồng vẫn ghi rõ phần mô phỏng
    await expect(page.locator("body")).toContainText(SIMULATION_LABEL);

    // Tab Tổng quan: không có XLM, gas, seed phrase
    await page.getByRole("button", { name: /Tổng quan/ }).first().click();
    let sectionText = await page.locator("main").first().innerText();
    expect(sectionText).not.toMatch(JARGON_REGEX);

    // Tab Tiền cọc: không có XLM, gas, seed phrase
    await page.getByRole("button", { name: /Tiền cọc/ }).first().click();
    sectionText = await page.locator("main").first().innerText();
    expect(sectionText).not.toMatch(JARGON_REGEX);

    // Tab Tiền thuê & công nợ: không có XLM, gas, seed phrase
    await page.getByRole("button", { name: /Tiền thuê/ }).first().click();
    sectionText = await page.locator("main").first().innerText();
    expect(sectionText).not.toMatch(JARGON_REGEX);
  });
});
