import { expect, test } from "@playwright/test";
import { loginAdmin } from "./helpers/admin-login";

/**
 * E2E cho trang Tổng quan (/admin) và Trực tiếp (/admin/truc-tiep) ở chế độ fixtures
 * (NEXT_PUBLIC_ADMIN_FIXTURES=1, không cần đăng nhập khi chưa gộp khung bảo vệ của Agent B).
 * Chạy với: E2E_BASE_URL=http://localhost:3123 pnpm exec playwright test tests/e2e/admin-overview.spec.ts
 */

test.describe("Admin Overview & Live Dashboard (fixtures)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAdmin(page, testInfo);
  });

  test("1. Trang /admin hiển thị đủ KPI, biểu đồ SVG có aria-label, và tooltip khi rê chuột", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Tổng quan hệ thống" })).toBeVisible();

    // Đủ 6 thẻ KPI chính
    for (const title of [
      "Người dùng",
      "Hợp đồng",
      "Cọc đang giữ (mô phỏng)",
      "Kỳ thuê quá hạn",
      "Tranh chấp đang mở",
      "Tỷ lệ on-chain thành công",
    ]) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }

    // Đủ biểu đồ SVG có aria-label (4 biểu đồ 30 ngày + 3 donut + 1 gauge + sparklines)
    const charts = page.locator("svg[aria-label]");
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(8);

    // Nguyên tắc sản phẩm: ghi rõ "mô phỏng", không xuất hiện thuật ngữ cấm
    const bodyText = await page.locator("main").innerText();
    expect(bodyText.toLowerCase()).toContain("mô phỏng");
    expect(bodyText).not.toMatch(/\bXLM\b/i);
    expect(bodyText).not.toMatch(/\bseed phrase\b/i);

    // Rê chuột lên biểu đồ AreaChart đầu tiên -> hiện tooltip nằm gọn trong khung
    const firstAreaSvg = page
      .locator('svg[aria-label="Biểu đồ vùng người dùng mới và lượt đăng nhập 30 ngày gần nhất"]')
      .first();
    await expect(firstAreaSvg).toBeVisible();
    const box = await firstAreaSvg.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);

    const tooltip = page.locator('[data-chart-tooltip="true"]').first();
    await expect(tooltip).toBeVisible();
    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(box!.x - 2);
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(box!.x + box!.width + 4);
  });

  test("2. Trang /admin/truc-tiep cập nhật sự kiện mới sau 6 giây và có nút Tạm dừng", async ({ page }) => {
    await page.goto("/admin/truc-tiep");

    await expect(page.getByRole("heading", { name: "Theo dõi trực tiếp" })).toBeVisible();
    await expect(page.getByTestId("live-active-users")).toBeVisible();

    // Có 2 biểu đồ trực tiếp 60 phút
    await expect(
      page.locator(
        'svg[aria-label="Biểu đồ đường trực tiếp số người dùng hoạt động theo phút trong 60 phút gần nhất"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator('svg[aria-label="Biểu đồ đường trực tiếp số sự kiện theo phút trong 60 phút gần nhất"]'),
    ).toBeVisible();

    const stream = page.getByTestId("live-event-stream");
    await expect(stream).toBeVisible();

    const initialFirstId = await stream.locator("li").first().getAttribute("data-event-id");
    expect(initialFirstId).toBeTruthy();

    // Sau 6 giây (chu kỳ 5 giây) có sự kiện mới xuất hiện trên cùng
    await page.waitForTimeout(6200);
    const nextFirstId = await stream.locator("li").first().getAttribute("data-event-id");
    expect(nextFirstId).toBeTruthy();
    expect(nextFirstId).not.toBe(initialFirstId);

    // Liên kết người dùng trỏ đúng tới /admin/nguoi-dung/[id]
    const userLink = stream.locator('a[href^="/admin/nguoi-dung/"]').first();
    await expect(userLink).toBeVisible();

    // Kiểm tra nút Tạm dừng hoạt động
    const pauseBtn = page.getByRole("button", { name: "Tạm dừng" });
    await pauseBtn.click();
    await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeVisible();
  });

  test("3. Khung điện thoại 390px không tràn ngang ở /admin và /admin/truc-tiep", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Tổng quan hệ thống" })).toBeVisible();
    const overviewScrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overviewScrollW).toBeLessThanOrEqual(390);

    await page.goto("/admin/truc-tiep");
    await expect(page.getByRole("heading", { name: "Theo dõi trực tiếp" })).toBeVisible();
    const liveScrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(liveScrollW).toBeLessThanOrEqual(390);
  });
});
