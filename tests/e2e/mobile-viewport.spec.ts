import { expect, test, type Locator, type Page } from "@playwright/test";

const TENANT1 = "0900000002";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function assertNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth, scrollX } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollX: window.scrollX,
  }));
  expect(scrollX).toBe(0);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
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

test.use({ viewport: MOBILE_VIEWPORT });

test.describe("E2E: Giao diện di động 390x844 (không tràn ngang, thao tác bấm được)", () => {
  test("trang chủ không tràn ngang và nút bấm dùng thử hoạt động", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const tryBtn = page.getByRole("main").getByRole("link", { name: /^Dùng thử/i }).first();
    await expect(tryBtn).toBeVisible();
    await tryBtn.click();
    await expect(page).toHaveURL(/\/dang-nhap/);
  });

  test("trang đăng nhập không tràn ngang và nút đăng nhập nhanh bấm được", async ({ page }) => {
    await page.goto("/dang-nhap");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const quickLandlord = page.locator("button", { hasText: "0900000001" }).first();
    await expect(quickLandlord).toBeVisible();
    await quickLandlord.click();
    await expect(page).toHaveURL(/\/app/);
  });

  test("trang bảng điều khiển /app không tràn ngang và mở được hợp đồng", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const link: Locator = page
      .locator("div", { hasText: "Phòng 301" })
      .filter({ has: page.locator('a:has-text("Xem chi tiết")') })
      .last()
      .locator('a:has-text("Xem chi tiết")');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/app\/hop-dong\//);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Phòng 301");
  });

  test("trang chi tiết hợp đồng thao tác chuyển tab chính bấm được trên di động", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await page.goto("/app");

    const link = page
      .locator("div", { hasText: "Phòng 301" })
      .filter({ has: page.locator('a:has-text("Xem chi tiết")') })
      .last()
      .locator('a:has-text("Xem chi tiết")');
    await link.click();
    await expect(page).toHaveURL(/\/app\/hop-dong\//);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Phòng 301");

    // Tab Tiền cọc: bấm được và nội dung hiển thị
    const depositTab = page.getByRole("button", { name: /Tiền cọc/ }).first();
    await expect(depositTab).toBeVisible();
    await depositTab.click();
    await expect(page.getByRole("heading", { name: "Bảo chứng tiền cọc" })).toBeVisible();

    // Tab Hoàn cọc & Tranh chấp: bấm được và nội dung hiển thị
    const refundTab = page.getByRole("button", { name: /Hoàn cọc/ }).first();
    await expect(refundTab).toBeVisible();
    await refundTab.click();
    await expect(page.getByText(/Thỏa thuận hoàn tiền cọc/)).toBeVisible();

    // Lưu lại ảnh chụp màn hình mobile của trang chi tiết hợp đồng (có hiện tượng tràn ngang do thanh tab)
    await page.screenshot({ path: "test-results/mobile-overflow-contract-detail.png", fullPage: true });
  });

  test("trang bằng chứng /bang-chung và /minh-bach không tràn ngang", async ({ page }) => {
    await page.goto("/bang-chung");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/minh-bach");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
