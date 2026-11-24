import { test, expect } from "@playwright/test";

const CHROME_PATH = "/run/current-system/sw/bin/google-chrome-stable";

test.use({
  baseURL: "http://127.0.0.1:3113",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  launchOptions: {
    executablePath: CHROME_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

test.describe("Kiểm tra giao diện điện thoại 390x844", () => {
  test("1. Bảng điều khiển (Dashboard)", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByRole("button", { name: /Chủ nhà: Nguyễn Văn An/i }).click();
    await page.waitForURL(/\/app/, { waitUntil: "domcontentloaded" });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page.getByText(/Xin chào/i).first()).toBeVisible();
    await expect(page.getByText("Danh sách hợp đồng").first()).toBeVisible();
  });

  test("2. Chi tiết hợp đồng đủ 5 tab (390x844)", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByRole("button", { name: /Chủ nhà: Nguyễn Văn An/i }).click();
    await page.waitForURL(/\/app/);

    // Mở hợp đồng đầu tiên trên bảng điều khiển
    await page.locator('a:has-text("Xem chi tiết")').first().click();
    await page.waitForURL(/\/app\/hop-dong\//);

    // Chờ hợp đồng tải xong (tab xuất hiện)
    await expect(page.locator("nav[aria-label='Tabs hợp đồng']")).toBeVisible();

    // Tab 1: Tổng quan
    await expect(page.getByText("Thông tin hợp đồng")).toBeVisible();
    const w1 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w1).toBeLessThanOrEqual(390);

    // Tab 2: Tiền cọc
    await page.getByRole("button", { name: /2\.\s*Tiền cọc/i }).click();
    await expect(page.getByRole("heading", { name: "Bảo chứng tiền cọc" })).toBeVisible();
    const w2 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w2).toBeLessThanOrEqual(390);

    // Tab 3: Tiền thuê & công nợ
    await page.getByRole("button", { name: /3\.\s*Tiền thuê & công nợ/i }).click();
    await expect(page.getByText("Tổng hợp công nợ hợp đồng").first()).toBeVisible();
    await expect(page.getByText("Khoản phát sinh (Điện, nước, dịch vụ)").first()).toBeVisible();
    const w3 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w3).toBeLessThanOrEqual(390);

    // Tab 4: Hoàn cọc & Tranh chấp
    await page.getByRole("button", { name: /4\.\s*Hoàn cọc & Tranh chấp/i }).click();
    await expect(page.getByText(/Hoàn trả tiền cọc|Tranh chấp/i).first()).toBeVisible();
    const w4 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w4).toBeLessThanOrEqual(390);

    // Tab 5: Bằng chứng on-chain
    await page.getByRole("button", { name: /5\.\s*Bằng chứng on-chain/i }).click();
    await expect(page.getByRole("heading", { name: /Sổ cái minh bạch/i })).toBeVisible();
    const w5 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w5).toBeLessThanOrEqual(390);
  });

  test("3. Hộp thoại thanh toán & nút Kiểm tra lại", async ({ page }) => {
    // Đăng nhập Người thuê 1
    await page.goto("/dang-nhap");
    await page.getByRole("button", { name: /Người thuê 1: Trần Thị Bình/i }).click();
    await page.waitForURL(/\/app/);

    // Mở hợp đồng của người thuê
    await page.locator('a:has-text("Xem chi tiết")').first().click();
    await page.waitForURL(/\/app\/hop-dong\//);

    // Kiểm tra xem có nút nộp cọc hoặc nộp tiền thuê
    let payBtn = page.getByRole("button", { name: /Nạp tiền cọc ngay/i }).first();
    let hasPayBtn = await payBtn.isVisible();

    if (!hasPayBtn) {
      await page.getByRole("button", { name: /2\.\s*Tiền cọc/i }).click();
      hasPayBtn = await payBtn.isVisible();
    }

    if (!hasPayBtn) {
      await page.getByRole("button", { name: /3\.\s*Tiền thuê & công nợ/i }).click();
      payBtn = page.getByRole("button", { name: /Nộp tiền/i }).first();
      hasPayBtn = await payBtn.isVisible();
    }

    if (hasPayBtn) {
      await payBtn.click();

      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();

      // Kiểm tra tràn ngang khi modal mở (scrollWidth <= 390)
      const modalWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(modalWidth).toBeLessThanOrEqual(390);

      // Thử bấm "Kiểm tra lại"
      const recheckBtn = modal.getByRole("button", { name: "Kiểm tra lại" });
      await expect(recheckBtn).toBeVisible();
      await recheckBtn.click();

      // Kiểm tra thông báo đối soát / chưa cấu hình / chờ xác nhận tiếng Việt
      await expect(
        modal.locator("text=/Đang chờ xác nhận|chưa được cấu hình|Đối soát/"),
      ).toBeVisible({ timeout: 5000 });

      // Đóng modal bằng nút đóng cuối bảng
      const closeBtn = modal.getByRole("button", { name: "Đóng cửa sổ" }).last();
      await closeBtn.click();
      await expect(modal).toBeHidden();
    }
  });

  test("4. Hộp thoại ký bước hai (StepUpModal)", async ({ page }) => {
    // Đăng nhập Người thuê 1
    await page.goto("/dang-nhap");
    await page.getByRole("button", { name: /Người thuê 1: Trần Thị Bình/i }).click();
    await page.waitForURL(/\/app/);

    // Mở hợp đồng có hành động ký
    await page.locator('a:has-text("Xem chi tiết")').first().click();
    await page.waitForURL(/\/app\/hop-dong\//);

    const confirmBtn = page.getByRole("button", { name: /Ký & Xác nhận hợp đồng/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();

      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();

      // Kiểm tra tràn ngang
      const modalWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(modalWidth).toBeLessThanOrEqual(390);

      // Đóng modal
      await modal.getByRole("button", { name: "Đóng" }).click();
      await expect(modal).toBeHidden();
    }
  });

  test("5. Khôi phục tài khoản (/app/khoi-phuc)", async ({ page }) => {
    // Đăng nhập nhanh trước
    await page.goto("/dang-nhap");
    await page.getByRole("button", { name: /Chủ nhà: Nguyễn Văn An/i }).click();
    await page.waitForURL(/\/app/);

    await page.goto("/app/khoi-phuc");
    await expect(page.getByText("Khôi phục tài khoản RentFlow")).toBeVisible();

    // Bước 1
    const w1 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w1).toBeLessThanOrEqual(390);

    // Huy hiệu MÔ PHỎNG
    await expect(page.getByText("MÔ PHỎNG").first()).toBeVisible();
  });
});
