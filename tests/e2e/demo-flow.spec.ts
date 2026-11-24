import { expect, test, type Locator, type Page } from "@playwright/test";

const LANDLORD = "0900000001";
const TENANT1 = "0900000002";
const TENANT2 = "0900000003";
const OTP = "123456";

async function loginViaUi(page: Page, phone: string) {
  await page.goto("/dang-nhap");
  await page.getByRole("textbox").first().fill(phone);
  await page
    .getByRole("button", { name: /OTP|Tiếp tục|Gửi/i })
    .first()
    .click();
  await page.getByRole("textbox").last().fill(OTP);
  await page
    .getByRole("button", { name: /Đăng nhập|Xác nhận|Xác thực/i })
    .first()
    .click();
  await page.waitForURL(/\/app/);
}

/** Thẻ hợp đồng trên bảng điều khiển: tìm phần tử nhỏ nhất chứa tên phòng và liên kết "Xem chi tiết". */
async function openContract(page: Page, room: string) {
  await page.goto("/app");
  const link: Locator = page
    .locator("div", { hasText: room })
    .filter({ has: page.locator('a:has-text("Xem chi tiết")') })
    .last()
    .locator('a:has-text("Xem chi tiết")');
  await link.click();
  await page.waitForURL(/\/app\/hop-dong\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(room);
}

async function tab(page: Page, name: RegExp) {
  await page.getByRole("button", { name }).first().click();
}

/** Ký bước hai bằng OTP mô phỏng. Passkey thật đã được kiểm thử riêng bằng thiết bị Passkey ảo. */
async function signStepUpWithOtp(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /OTP \(mô phỏng\)/ }).click();
  await dialog.getByRole("button", { name: /Xác nhận & Ký/ }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("RentFlow: luồng trình diễn trên giao diện thật", () => {
  test("chuẩn bị kịch bản demo và chờ giao dịch Testnet", async ({ request, baseURL }) => {
    const res = await request.post("/api/demo/prepare", { headers: { origin: baseURL! } });
    expect(res.status()).toBe(200);
    // 10 giao dịch của kịch bản phải được xác nhận trên Testnet
    await expect
      .poll(async () => ((await (await request.get("/api/public/onchain-feed")).json()).data ?? []).length, {
        timeout: 180_000,
        intervals: [3000],
      })
      .toBeGreaterThanOrEqual(10);
  });

  test("bước 1: người thuê ký hợp đồng Phòng 301", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await openContract(page, "Phòng 301");
    await expect(page.getByText("Chờ xác nhận").first()).toBeVisible();
    await page.getByRole("button", { name: /Xác nhận & Ký hợp đồng/ }).click();
    await signStepUpWithOtp(page);
    await expect(page.getByText("Đang hiệu lực").first()).toBeVisible({ timeout: 30_000 });
  });

  test("bước 2: người thuê nạp cọc bằng VietQR mô phỏng", async ({ page }) => {
    await loginViaUi(page, TENANT1);
    await openContract(page, "Phòng 301");
    await tab(page, /Tiền cọc/);
    await page
      .getByRole("button", { name: /Nạp|Thanh toán/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("MÔ PHỎNG").first()).toBeVisible();
    await dialog.getByRole("button", { name: /Giả lập: Đã nhận đủ tiền/ }).click();
    await expect(page.getByText("Đã ghi nhận").first()).toBeVisible({ timeout: 30_000 });
  });

  test("bước 3: chủ nhà thấy kỳ quá hạn có phí trễ và gia hạn thanh toán", async ({ page }) => {
    await loginViaUi(page, LANDLORD);
    await openContract(page, "Phòng 402");
    await tab(page, /Tiền thuê/);
    await expect(page.getByText("Quá hạn").first()).toBeVisible();
    await page.getByRole("button", { name: "Gia hạn thanh toán" }).first().click();
    const due = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Hạn thanh toán mới").fill(due);
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await signStepUpWithOtp(page);
    await expect(page.getByText("Chờ thanh toán").first()).toBeVisible({ timeout: 30_000 });
  });

  test("bước 4: hoàn cọc cần cả hai bên cùng xác nhận", async ({ browser }) => {
    const tenantCtx = await browser.newContext();
    const landlordCtx = await browser.newContext();
    const tenant = await tenantCtx.newPage();
    const landlord = await landlordCtx.newPage();

    await loginViaUi(tenant, TENANT1);
    await openContract(tenant, "Phòng 402");
    await tab(tenant, /Hoàn cọc/);
    await tenant
      .getByRole("button", { name: /Yêu cầu hoàn cọc|Gửi yêu cầu/ })
      .first()
      .click();
    await expect(tenant.getByText(/Chờ hoàn cọc/).first()).toBeVisible({ timeout: 30_000 });

    await loginViaUi(landlord, LANDLORD);
    await openContract(landlord, "Phòng 402");
    await tab(landlord, /Hoàn cọc/);
    await landlord
      .getByRole("button", { name: /Duyệt|Xác nhận hoàn/ })
      .first()
      .click();
    await signStepUpWithOtp(landlord);
    // Mới một bên duyệt: chưa được giải ngân
    await expect(landlord.getByText(/Đã hoàn trả/)).toHaveCount(0);

    await tenant.reload();
    await tab(tenant, /Hoàn cọc/);
    await tenant
      .getByRole("button", { name: /Duyệt|Xác nhận hoàn/ })
      .first()
      .click();
    await signStepUpWithOtp(tenant);
    await expect(tenant.getByText("Đã hoàn trả").first()).toBeVisible({ timeout: 30_000 });
    await tenantCtx.close();
    await landlordCtx.close();
  });

  test("bước 5: cọc đang chờ xử lý tranh chấp, hệ thống không tự kết luận", async ({ page }) => {
    await loginViaUi(page, TENANT2);
    await openContract(page, "Phòng 102");
    await expect(page.getByText(/Chờ xử lý tranh chấp/).first()).toBeVisible();
    await tab(page, /Hoàn cọc/);
    await expect(page.getByText(/không tự|đồng thuận|hai bên/i).first()).toBeVisible();
  });

  test("bằng chứng on-chain: giao dịch thật, có liên kết explorer, không dữ liệu cá nhân", async ({
    page,
  }) => {
    await loginViaUi(page, LANDLORD);
    await openContract(page, "Phòng 402");
    await tab(page, /Bằng chứng on-chain/);
    await expect(page.getByText(/create_contract|Đã ghi nhận/).first()).toBeVisible();
    const hrefs = await page
      .locator('a[href*="stellar.expert"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/0900000001|0900000002|Nguyễn Văn An|Trần Thị Bình/);

    await page.goto("/bang-chung");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bằng chứng");
    await expect(page.locator('a[href*="stellar.expert"]').first()).toBeVisible();
  });
});
