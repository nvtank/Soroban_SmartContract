import { test, expect, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers/admin-login";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3124";

test.use({
  baseURL: BASE_URL,
  viewport: { width: 1440, height: 900 },
});

const FORBIDDEN_BUTTON_PATTERN = /Phân xử|Giải ngân|Sửa/i;
const RAW_PHONE_PATTERN = /(?<!\d)0\d{9}(?!\d)/;
const FORBIDDEN_WEB3_PATTERN = /\b(XLM|gas|seed phrase)\b/i;

async function assertAdminInvariants(page: Page) {
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(RAW_PHONE_PATTERN);
  expect(bodyText).not.toMatch(FORBIDDEN_WEB3_PATTERN);

  const buttons = page.locator("button, [role='button']");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const label = (await buttons.nth(i).innerText()).trim();
    expect(label).not.toMatch(FORBIDDEN_BUTTON_PATTERN);
  }
}

test.describe("Admin Data Pages (Fixtures Mode)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAdmin(page, testInfo);
  });

  test("Người dùng: bảng có dữ liệu, lọc đổi URL, tìm kiếm giảm dòng, phân trang, mở chi tiết", async ({
    page,
  }) => {
    await page.goto("/admin/nguoi-dung");
    await expect(page.getByRole("heading", { name: "Người dùng" })).toBeVisible();

    const desktopRows = page.locator("table tbody tr");
    await expect(desktopRows.first()).toBeVisible();
    const initialCount = await desktopRows.count();
    expect(initialCount).toBe(20);

    // Số điện thoại đã che và không có SĐT 10 số liền
    await expect(
      page
        .locator("table tbody")
        .getByText(/09\d\*\*\*\d{4}/)
        .first(),
    ).toBeVisible();
    await assertAdminInvariants(page);

    // Phân trang sang trang 2
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(desktopRows.first()).toBeVisible();

    // Lọc theo vai trò Chủ nhà -> URL đổi và quay về trang 1
    await page.locator("#admin-table-filter").selectOption("LANDLORD");
    await expect(page).toHaveURL(/role=LANDLORD/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(desktopRows.first()).toBeVisible();
    const filteredCount = await desktopRows.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Bỏ lọc vai trò rồi tìm kiếm để giảm số dòng
    await page.locator("#admin-table-filter").selectOption("");
    await expect(page).not.toHaveURL(/role=/);
    await expect(desktopRows).toHaveCount(20);

    const searchInput = page.locator("input[type='search']");
    await searchInput.fill("Nguyễn");
    await expect(page).toHaveURL(/q=/);
    await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
    await expect(desktopRows.first()).toBeVisible();
    const searchedCount = await desktopRows.count();
    expect(searchedCount).toBeGreaterThan(0);
    expect(searchedCount).toBeLessThan(20);

    // Mở chi tiết người dùng đầu tiên
    await desktopRows.first().locator("a").first().click();
    await expect(page).toHaveURL(/\/admin\/nguoi-dung\/[0-9a-f-]+/i);
    await expect(page.getByText("Thông tin tài khoản")).toBeVisible();
    await expect(page.getByText("Hoạt động 30 ngày gần nhất")).toBeVisible();
    await expect(page.locator("svg[role='img']")).toBeVisible();
    await expect(page.getByRole("link", { name: /Stellar Expert/i })).toBeVisible();
    await assertAdminInvariants(page);
  });

  test("Hợp đồng: bảng có dữ liệu, lọc trạng thái, tìm kiếm, mở chi tiết chỉ xem", async ({ page }) => {
    await page.goto("/admin/hop-dong");
    await expect(page.getByRole("heading", { name: "Hợp đồng" })).toBeVisible();

    const desktopRows = page.locator("table tbody tr");
    await expect(desktopRows.first()).toBeVisible();
    const initialCount = await desktopRows.count();
    expect(initialCount).toBe(20);
    await assertAdminInvariants(page);

    // Lọc trạng thái ACTIVE -> đổi URL
    await page.locator("#admin-table-filter").selectOption("ACTIVE");
    await expect(page).toHaveURL(/status=ACTIVE/);
    await expect(desktopRows.first()).toBeVisible();

    // Tìm kiếm làm giảm số dòng
    await page.locator("#admin-table-filter").selectOption("");
    await expect(desktopRows).toHaveCount(20);
    await page.locator("input[type='search']").fill("Sunrise");
    await expect(page).toHaveURL(/q=Sunrise/);
    await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
    await expect(desktopRows.first()).toBeVisible();
    const searchedContracts = await desktopRows.count();
    expect(searchedContracts).toBeGreaterThan(0);
    expect(searchedContracts).toBeLessThan(20);

    // Mở chi tiết hợp đồng
    await desktopRows.first().locator("a").first().click();
    await expect(page).toHaveURL(/\/admin\/hop-dong\/[0-9a-f-]+/i);
    await expect(
      page.getByText("Admin không phân xử tranh chấp. Tranh chấp chỉ kết thúc khi hai bên cùng đồng ý."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Các kỳ thuê" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Lịch sử thanh toán/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Giao dịch on-chain/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sự kiện của hợp đồng" })).toBeVisible();
    await assertAdminInvariants(page);
  });

  test("Thanh toán: ghi rõ tiền mô phỏng, bảng có dữ liệu, lọc trạng thái và phân trang", async ({
    page,
  }) => {
    await page.goto("/admin/thanh-toan");
    await expect(page.getByRole("heading", { name: /Thanh toán \(mô phỏng\)/i })).toBeVisible();

    const desktopRows = page.locator("table tbody tr");
    await expect(desktopRows.first()).toBeVisible();
    expect(await desktopRows.count()).toBe(20);
    await assertAdminInvariants(page);

    // Lọc trạng thái CONFIRMED
    await page.locator("#admin-table-filter").selectOption("CONFIRMED");
    await expect(page).toHaveURL(/status=CONFIRMED/);
    await expect(desktopRows.first()).toBeVisible();

    // Bỏ lọc và phân trang
    await page.locator("#admin-table-filter").selectOption("");
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(desktopRows.first()).toBeVisible();
  });

  test("Giao diện điện thoại 390px không tràn ngang trên tất cả trang admin data", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const routes = [
      "/admin/nguoi-dung",
      "/admin/nguoi-dung/00000000-0000-4000-8000-000000000001",
      "/admin/hop-dong",
      "/admin/hop-dong/10000000-0000-4000-8000-000000000001",
      "/admin/thanh-toan",
    ];

    for (const route of routes) {
      await page.goto(route);
      // Chờ dữ liệu tải xong (hết aria-busy)
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 15_000 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `Tràn ngang tại ${route}`).toBeLessThanOrEqual(390);
      await assertAdminInvariants(page);
    }
  });
});
