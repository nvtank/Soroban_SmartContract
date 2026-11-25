import { loginAdmin } from "./helpers/admin-login";
import { expect, test } from "@playwright/test";

const fixtureUrl = "http://localhost:3125";
const pages = [
  { path: "on-chain", ready: "Giao dịch" },
  { path: "nhat-ky", ready: "Nhật ký kiểm toán" },
  { path: "khoi-phuc", ready: "Yêu cầu chờ duyệt" },
  { path: "he-thong", ready: "Cơ sở dữ liệu" },
];

test.describe("Admin operations (fixtures)", () => {
  test.skip(
    process.env.NEXT_PUBLIC_ADMIN_FIXTURES !== "1" && process.env.E2E_BASE_URL !== fixtureUrl,
    "Chỉ chạy khi máy chủ ở chế độ dữ liệu mẫu (NEXT_PUBLIC_ADMIN_FIXTURES=1).",
  );

  test.beforeEach(async ({ page }, testInfo) => {
    await loginAdmin(page, testInfo);
  });

  test("bộ đếm lọc giao dịch và hiện chi tiết lỗi", async ({ page }) => {
    await page.goto("/admin/on-chain");
    const all = page.getByRole("button", { name: /Tất cả/ });
    const failed = page.getByRole("button", { name: /FAILED/ });
    const rows = page.getByRole("list", { name: "Danh sách giao dịch" }).getByRole("listitem");
    await expect(all).toContainText("80");
    const failedCount = Number((await failed.innerText()).split("\n")[1]);
    expect(failedCount).toBeGreaterThan(0);
    await failed.click();
    await expect(failed).toHaveAttribute("aria-pressed", "true");
    await expect(rows).toHaveCount(Math.min(failedCount, 10));
    for (const row of await rows.all()) await expect(row.getByText("FAILED", { exact: true })).toBeVisible();
    const detail = rows.first().locator("details");
    await detail.locator("summary").click();
    await expect(detail).toHaveAttribute("open", "");
    await expect(detail.locator("p")).toContainText("Transaction execution failed");
    await page.getByRole("button", { name: /SUBMITTED/ }).click();
    await expect(page.getByText("Không có giao dịch ở trạng thái này.")).toBeVisible();
  });

  test("chỉ FAILED có thể thử lại và giao dịch trở về PENDING", async ({ page }) => {
    await page.goto("/admin/on-chain");
    const rows = page.getByRole("list", { name: "Danh sách giao dịch" }).getByRole("listitem");
    await expect(rows).toHaveCount(10);
    const retryRow = rows.filter({ has: page.getByRole("button", { name: "Thử lại", exact: true }) }).first();
    for (const row of await rows.all()) {
      const retryButton = row.getByRole("button", { name: "Thử lại", exact: true });
      await expect(retryButton).toHaveCount(await row.getByText("FAILED", { exact: true }).count());
    }
    if (!(await retryRow.count())) {
      await page.getByRole("button", { name: /FAILED/ }).click();
      await expect(retryRow).toBeVisible();
    }
    const row = rows.nth(
      await retryRow.evaluate((element) => [...(element.parentElement?.children ?? [])].indexOf(element)),
    );
    const action = await row.locator("code").innerText();
    await row.getByRole("button", { name: "Thử lại", exact: true }).click();
    const confirmation = row.getByRole("group", { name: "Đưa giao dịch này trở lại hàng đợi?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Hủy" }).click();
    await expect(row.getByText("FAILED", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Thử lại", exact: true }).click();
    await confirmation.getByRole("button", { name: "Xác nhận thử lại" }).click();
    await expect(page.getByRole("status")).toContainText(`Đã yêu cầu thử lại ${action}. Trạng thái PENDING.`);
    if ((await page.getByRole("button", { name: /Tất cả/ }).getAttribute("aria-pressed")) === "true") {
      await expect(row.getByText("PENDING", { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: /PENDING/ }).click();
    await expect(rows.filter({ has: page.locator("code", { hasText: action }) }).first()).toBeVisible();
    await expect(rows.getByRole("button", { name: "Thử lại", exact: true })).toHaveCount(0);
  });

  test("nhật ký chia ngày, tìm kiếm, lọc và phân trang", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-25T21:00:00Z"));
    await page.goto("/admin/nhat-ky");
    const days = page.getByRole("heading", { level: 2 });
    await expect(days.first()).toHaveText(/\d+ tháng \d+, \d{4}/);
    await expect(days).toHaveCount(2);
    const firstDay = await days.first().innerText();
    await expect(page.getByRole("region", { name: firstDay }).getByRole("listitem").first()).toBeVisible();
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 2 / 6");
    const events = page.getByRole("article");
    const observedAction = await events.first().locator("code").innerText();
    await page.getByLabel("Tìm kiếm").fill("không có sự kiện này");
    await page.getByRole("button", { name: "Lọc nhật ký" }).click();
    await expect(page.getByText("Không tìm thấy hoạt động phù hợp.")).toBeVisible();
    await page.getByRole("button", { name: "Xóa lọc" }).click();
    await page.getByLabel("Hành động").fill(observedAction);
    await page.getByRole("button", { name: "Lọc nhật ký" }).click();
    await expect(events.first()).toBeVisible();
    for (const event of await events.all())
      await expect(event.getByText(observedAction, { exact: true })).toBeVisible();
  });

  test("duyệt khôi phục sau khi xác nhận và giữ số điện thoại đã che", async ({ page }) => {
    await page.goto("/admin/khoi-phuc");
    await expect(page.getByText(/eKYC.*mô phỏng/)).toBeVisible();
    const list = page.getByRole("list", { name: "Yêu cầu khôi phục" });
    const requests = list.getByRole("listitem");
    await expect(requests).toHaveCount(2);
    const first = requests.first();
    const name = await first.getByRole("heading").innerText();
    await expect(first).toContainText(/0\d{2}\*{3}\d{4}/);
    await first.getByRole("button", { name: "Duyệt", exact: true }).click();
    const confirmation = first.getByRole("group", { name: `Duyệt yêu cầu khôi phục của ${name}?` });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Xác nhận duyệt" }).click();
    await expect(page.getByRole("status")).toContainText(`Đã duyệt yêu cầu khôi phục của ${name}.`);
    await expect(requests).toHaveCount(1);
    await page.getByRole("button", { name: "Làm mới" }).click();
    await expect(list.getByRole("heading", { name, exact: true })).toHaveCount(0);
  });

  test("hệ thống hiển thị đủ thẻ và phản hồi cả hai tác vụ", async ({ page }) => {
    await page.goto("/admin/he-thong");
    for (const name of [
      "Cơ sở dữ liệu",
      "Stellar RPC",
      "Contract",
      "Ví nền tảng",
      "Ví oracle",
      "Hàng đợi on-chain",
      "Chế độ vận hành",
      "Tác vụ nền",
    ]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText("XLM testnet", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("link", { name: /Xem contract trên Stellar Expert/ })).toHaveAttribute(
      "href",
      /^https:\/\/stellar\.expert\/explorer\/testnet\/contract\//,
    );
    await page.getByRole("button", { name: "Quét kỳ quá hạn" }).click();
    await expect(page.getByRole("status")).toContainText("Quét kỳ quá hạn hoàn tất với dữ liệu mẫu.");
    await page.getByRole("button", { name: "Đẩy hàng đợi on-chain" }).click();
    await expect(page.getByRole("status")).toContainText("Đẩy hàng đợi on-chain hoàn tất với dữ liệu mẫu.");
  });

  test("đường dẫn quản trị cũ chuyển sang trang khôi phục", async ({ page }) => {
    await page.goto("/app/admin-demo");
    await expect(page).toHaveURL(/\/admin\/khoi-phuc$/);
    await expect(page.getByRole("heading", { name: "Yêu cầu chờ duyệt" })).toBeVisible();
  });

  for (const width of [390, 1440]) {
    test(`bốn trang không tràn ngang ở ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const { path, ready } of pages) {
        await page.goto(`/admin/${path}`);
        await expect(page.getByRole("heading", { name: ready, exact: true })).toBeVisible();
        if (path === "nhat-ky") await expect(page.getByRole("article").first()).toBeVisible();
        const dimensions = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }));
        expect(dimensions.page, `/admin/${path}`).toBeLessThanOrEqual(dimensions.viewport);
        if (process.env.RENTFLOW_OPS_SCREENSHOTS === "1") {
          await page.screenshot({ path: `.rentflow-task/after/${path}-${width}.png` });
        }
      }
    });
  }
});
