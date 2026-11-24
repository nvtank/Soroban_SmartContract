import { expect, test, type Locator, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const LANDLORD = "0900000001";
const TENANT1 = "0900000002";
const TENANT2 = "0900000003";
const OTP = "123456";

function getCronSecret(): string {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^CRON_SECRET=(.*)$/m);
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
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
  await otpInput.fill(OTP);
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

async function tab(page: Page, name: RegExp) {
  await page.getByRole("button", { name }).first().click();
}

async function signStepUpWithOtp(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /OTP \(mô phỏng\)/ }).click();
  await dialog.getByRole("button", { name: /Xác nhận & Ký/ }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

test.describe("Kịch bản trình diễn Video dự phòng (5 bước theo docs/DEMO_SCRIPT.md)", () => {
  test("chạy toàn bộ kịch bản demo và xuất video demo-backup.webm", async ({ browser, baseURL, request }) => {
    test.skip(!process.env.E2E_VIDEO, "Chỉ chạy khi có cờ E2E_VIDEO=1 để xuất video dự phòng (dùng lệnh pnpm e2e:video)");

    // 0. Chuẩn bị kịch bản demo trên Testnet
    const cronSecret = getCronSecret();
    const res = await request.post("/api/demo/prepare", {
      headers: {
        origin: baseURL!,
        ...(cronSecret ? { authorization: `Bearer ${cronSecret}` } : {}),
      },
    });
    expect(res.status()).toBe(200);

    // Chờ 10 giao dịch ban đầu ghi lên Testnet
    await expect
      .poll(async () => ((await (await request.get("/api/public/onchain-feed")).json()).data ?? []).length, {
        timeout: 180_000,
        intervals: [3000],
      })
      .toBeGreaterThanOrEqual(10);

    // Mở một context riêng có bật recordVideo để quay toàn bộ video liền mạch
    const videoDir = path.resolve(process.cwd(), "test-results");
    const context = await browser.newContext({
      viewport: { width: 1366, height: 820 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1366, height: 820 },
      },
    });

    const page = await context.newPage();

    try {
      // -------------------------------------------------------------
      // 0:00 MỞ ĐẦU (Trang chủ & Minh bạch)
      // -------------------------------------------------------------
      await page.goto("/");
      await page.waitForTimeout(1000);
      const banner = page.locator('[role="note"]');
      await expect(banner).toBeVisible();
      await page.goto("/minh-bach");
      await page.waitForTimeout(1000);

      // -------------------------------------------------------------
      // 0:30 BƯỚC 1: KÝ HỢP ĐỒNG (Phòng 301 - Tòa Sunrise)
      // -------------------------------------------------------------
      // Chủ nhà đăng nhập xem danh sách hợp đồng
      await loginViaUi(page, LANDLORD);
      await page.waitForTimeout(1000);

      // Người thuê 1 đăng nhập và ký hợp đồng
      await loginViaUi(page, TENANT1);
      await openContract(page, "Phòng 301");
      await expect(page.getByText("Chờ xác nhận").first()).toBeVisible();
      await page.getByRole("button", { name: /Xác nhận & Ký hợp đồng/ }).click();
      await signStepUpWithOtp(page);
      await expect(page.getByText("Đang hiệu lực").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1000);

      // -------------------------------------------------------------
      // 1:15 BƯỚC 2: NẠP CỌC BẰNG VIETQR MÔ PHỎNG
      // -------------------------------------------------------------
      await tab(page, /Tiền cọc/);
      await page.getByRole("button", { name: /Nạp|Thanh toán/ }).first().click();
      const paymentDialog = page.getByRole("dialog");
      await expect(paymentDialog.getByText("MÔ PHỎNG").first()).toBeVisible();
      await paymentDialog.getByRole("button", { name: /Giả lập: Đã nhận đủ tiền/ }).click();
      await expect(page.getByText("Đã ghi nhận").first()).toBeVisible({ timeout: 30_000 });

      // Mở ngăn bằng chứng on-chain xem giao dịch record_deposit_paid
      const proofBtn = page.getByRole("button", { name: /Bằng chứng On-chain/i }).first();
      if (await proofBtn.isVisible()) {
        await proofBtn.click();
        await page.waitForTimeout(1500);
        // Đóng ngăn kéo
        const closeDrawer = page.locator('button[aria-label="Đóng"], button:has-text("✕")').first();
        if (await closeDrawer.isVisible()) await closeDrawer.click();
      }

      // -------------------------------------------------------------
      // 2:00 BƯỚC 3: TIỀN THUÊ VÀ GIA HẠN THANH TOÁN
      // -------------------------------------------------------------
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
      await page.waitForTimeout(1000);

      // -------------------------------------------------------------
      // 2:45 BƯỚC 4: HOÀN CỌC ĐA BÊN CÙNG XÁC NHẬN
      // -------------------------------------------------------------
      // Người thuê xác nhận hoàn cọc
      await loginViaUi(page, TENANT1);
      await openContract(page, "Phòng 402");
      await tab(page, /Hoàn cọc/);
      await page.getByRole("button", { name: "Xác nhận hoàn cọc" }).click();
      await signStepUpWithOtp(page);
      await expect(page.getByText("6.000.000").first()).toBeVisible({ timeout: 30_000 });

      // Chủ nhà duyệt cùng số tiền
      await loginViaUi(page, LANDLORD);
      await openContract(page, "Phòng 402");
      await tab(page, /Hoàn cọc/);
      await page.getByRole("button", { name: "Xác nhận hoàn cọc" }).click();
      await signStepUpWithOtp(page);
      await expect(page.getByText("Đã hoàn trả").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1000);

      // -------------------------------------------------------------
      // 3:30 BƯỚC 5: TRANH CHẤP TRUNG LẬP
      // -------------------------------------------------------------
      await loginViaUi(page, TENANT2);
      await openContract(page, "Phòng 102");
      await expect(page.getByText(/Chờ xử lý tranh chấp/).first()).toBeVisible();
      await tab(page, /Hoàn cọc/);
      await expect(page.getByText(/không tự|đồng thuận|hai bên/i).first()).toBeVisible();
      await page.waitForTimeout(1000);

      // -------------------------------------------------------------
      // 4:15 KẾT LUẬN: SỔ CÁI BẰNG CHỨNG ON-CHAIN
      // -------------------------------------------------------------
      await page.goto("/bang-chung");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Bằng chứng");
      await expect(page.locator('a[href*="stellar.expert"]').first()).toBeVisible();
      await page.waitForTimeout(2000);
    } finally {
      const video = page.video();
      await page.close();
      await context.close();

      if (video) {
        const dest = path.resolve(process.cwd(), "demo-assets", "demo-backup.webm");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await video.saveAs(dest);
        const stat = fs.statSync(dest);
        console.log(`[VIDEO EXPORTED] Path: ${dest}, Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB (${stat.size} bytes)`);
      }
    }
  });
});
