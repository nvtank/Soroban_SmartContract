import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const ADMIN = "0900000004";
const TENANT = "0900000002";
const LOGIN = "/admin/dang-nhap";
const artifactDir = process.env.E2E_ADMIN_ARTIFACT_DIR;

test.use({ viewport: { width: 1440, height: 900 } });

function readAdminOtp() {
  const otp = readFileSync(".env.local", "utf8")
    .match(/^DEMO_ADMIN_OTP=(.*)$/m)?.[1]
    .trim()
    .replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  if (!otp || otp.length < 8 || otp.length > 32) {
    throw new Error("Cần DEMO_ADMIN_OTP từ 8 đến 32 ký tự trong .env.local.");
  }
  return otp;
}

async function requestCode(page: Page, phone: string) {
  await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Yêu cầu mã OTP" }).click();
  await expect(page.getByLabel("Mã OTP", { exact: true })).toBeVisible();
}

async function submitCode(page: Page, code: string) {
  await page.getByLabel("Mã OTP", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Xác nhận đăng nhập" }).click();
}

async function expectAdminPage(page: Page, path = "/admin") {
  await expect(page).toHaveURL((url) => url.pathname + url.search === path);
  await expect(page.locator("#admin-content:visible")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("mô phỏng");
}

async function capture(page: Page, label: string) {
  if (!artifactDir) return;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${artifactDir}/${label}.png` });
}

test("khách được chuyển đến trang đăng nhập admin và giữ lại đường dẫn", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL((url) => url.pathname === LOGIN && url.searchParams.get("next") === "/admin");
  await expect(page.getByRole("heading", { name: "Đăng nhập quản trị" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Điều hướng quản trị" })).toHaveCount(0);
  await expect(page.getByRole("note")).toContainText("mô phỏng");
  await capture(page, "login-desktop");

  await page.goto("/admin/nguoi-dung/chi-tiet?tab=activity");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === LOGIN && url.searchParams.get("next") === "/admin/nguoi-dung/chi-tiet?tab=activity",
  );
});

test("từ chối mã OTP hợp lệ của người thuê trên trang admin và xóa phiên", async ({ page }) => {
  await page.goto(LOGIN);
  await requestCode(page, TENANT);
  await submitCode(page, "123456");
  await expect(page.locator("#admin-login-error")).toHaveText("Tài khoản này không có quyền quản trị");
  await expect(page.getByRole("button", { name: "Xác nhận đăng nhập" })).toBeEnabled();
  expect((await page.context().cookies()).some(({ name }) => name === "rentflow_session")).toBe(false);

  await page.goto("/admin");
  await expect(page).toHaveURL((url) => url.pathname === LOGIN && url.searchParams.get("next") === "/admin");
});

test("phiên người thuê từ trang ứng dụng không cấp quyền quản trị", async ({ page }) => {
  await page.goto("/dang-nhap");
  await page.getByRole("button", { name: new RegExp(TENANT) }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/app");

  await page.goto("/admin");
  await expect(page).toHaveURL((url) => url.pathname === LOGIN && url.searchParams.get("next") === "/admin");
});

test("admin có thể thử lại sau khi nhập sai mã, thu gọn thanh bên và đăng xuất", async ({ page }) => {
  const otp = readAdminOtp();
  await page.goto(LOGIN);
  await requestCode(page, ADMIN);
  await submitCode(page, otp === "00000000" ? "11111111" : "00000000");
  await expect(page.locator("#admin-login-error")).toContainText("Mã OTP không đúng");
  await expect(page).toHaveURL((url) => url.pathname === LOGIN);

  await submitCode(page, otp);
  await expectAdminPage(page);
  await page.goto(`${LOGIN}?next=/admin/truc-tiep`);
  await expectAdminPage(page);

  const nav = page.getByRole("navigation", { name: "Điều hướng quản trị" });
  await expect(nav.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
  await capture(page, "shell-desktop");
  const expanded = await nav.boundingBox();
  await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
  await expect(page.getByRole("button", { name: "Mở rộng thanh bên" })).toBeVisible();
  const collapsed = await nav.boundingBox();
  expect(collapsed!.width).toBeLessThan(expanded!.width);

  await page.getByLabel("Tài khoản quản trị").click();
  await expect(page.getByRole("link", { name: "Về trang chủ" })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập quản trị" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL((url) => url.pathname === LOGIN);
});

test("bỏ qua đích chuyển hướng ngoài trang", async ({ page }) => {
  await page.goto(`${LOGIN}?next=https://evil.example`);
  await requestCode(page, ADMIN);
  await submitCode(page, readAdminOtp());
  await expectAdminPage(page);
});

test("giữ đích admin hợp lệ và mở đóng ngăn kéo ở 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin?view=mobile");
  await expect(page.getByRole("heading", { name: "Đăng nhập quản trị" })).toBeVisible();
  await capture(page, "login-mobile");
  await requestCode(page, ADMIN);
  await submitCode(page, readAdminOtp());
  await expectAdminPage(page, "/admin?view=mobile");
  await capture(page, "shell-mobile");

  const open = page.getByRole("button", { name: "Mở điều hướng" });
  const drawer = page.getByRole("dialog", { name: "Điều hướng quản trị" });
  await open.click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Hệ thống" })).toBeVisible();
  await capture(page, "drawer-mobile");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(open).toBeFocused();

  await open.click();
  await drawer.getByRole("button", { name: "Đóng điều hướng" }).click();
  await expect(drawer).toBeHidden();
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: Array.from(document.querySelectorAll("body *"))
      .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth)
      .map((element) => ({ tag: element.tagName, classes: element.getAttribute("class") })),
  }));
  expect(viewport.scrollWidth, JSON.stringify(viewport.overflow)).toBe(viewport.width);
});
