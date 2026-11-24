import { expect, test, type Locator, type Page } from "@playwright/test";

const LANDLORD = "0900000001";
const TENANT1 = "0900000002";

// Ghi đè storageState mặc định của playwright.config.ts để tour TỰ MỞ khi đăng nhập.
test.use({
  storageState: { cookies: [], origins: [] },
});

async function loginViaUi(page: Page, phone: string) {
  await page.goto("/dang-nhap");
  await page.evaluate(() => {
    window.localStorage.removeItem("rentflow.tour.disabled");
    window.localStorage.removeItem("rentflow.tour.tenant.v1");
    window.localStorage.removeItem("rentflow.tour.landlord.v1");
    window.sessionStorage.removeItem("rentflow.tour.progress.v1");
  });

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

async function measureGapBetween(target: Locator, popup: Locator): Promise<number> {
  const tBox = await target.boundingBox();
  const pBox = await popup.boundingBox();
  expect(tBox).not.toBeNull();
  expect(pBox).not.toBeNull();

  const dx = Math.max(0, tBox!.x - (pBox!.x + pBox!.width), pBox!.x - (tBox!.x + tBox!.width));
  const dy = Math.max(0, tBox!.y - (pBox!.y + pBox!.height), pBox!.y - (tBox!.y + tBox!.height));
  return Math.hypot(dx, dy);
}

test.describe("E2E: Hướng dẫn từng bước cho người mới (Product Tour)", () => {
  test("người thuê: tự hiện, chặn bấm ngoài, bám sát phần tử, tự nhảy bước, chuyển trang, bỏ qua & mở lại", async ({
    page,
  }) => {
    await loginViaUi(page, TENANT1);

    // 1. Tour tự hiện tại bước 1
    const popup = page.locator('[data-tour-popup="1"]');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-dashboard-stats");
    await expect(popup.locator('[data-tour-counter="1"]')).toHaveText(/^1\//);

    // Kiểm tra khoảng cách popup tới phần tử đích ≤ 24px
    const statsTarget = page.locator('[data-tour="dashboard-stats"]').first();
    await expect(statsTarget).toBeVisible();
    const gap = await measureGapBetween(statsTarget, popup);
    expect(gap).toBeLessThanOrEqual(24);

    // 2. Bấm ra ngoài (lớp phủ chặn) -> URL không đổi và popup vẫn ở bước 1
    const urlBefore = page.url();
    const topBlocker = page.locator('[data-tour-blocker="top"]');
    if (await topBlocker.isVisible()) {
      const box = await topBlocker.boundingBox();
      if (box && box.height > 10) {
        await page.mouse.click(box.x + 20, box.y + Math.min(20, box.height / 2));
      }
    }
    await expect(page).toHaveURL(urlBefore);
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-dashboard-stats");

    // 3. Bấm "Tiếp theo" -> bước 2 (contract-list) -> bước 3 (tenant-open-301, click + safeAutoClick)
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-contract-list");

    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-open-301");

    // 4. Bấm "Tiếp theo" ở bước safeAutoClick -> chuyển trang tới chi tiết Phòng 301 và giữ tiến độ
    await popup.locator('[data-tour-action="next"]').click();
    await expect(page).toHaveURL(/\/app\/hop-dong\//);
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-contract-status");

    // 5. Bấm "Quay lại" về bước 3 trên /app, sau đó bấm TRỰC TIẾP vào nút đích -> tự nhảy sang bước 4
    await popup.locator('[data-tour-action="prev"]').click();
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-open-301");

    const open301Btn = page
      .locator('[data-tour="contract-card"][data-tour-key="301"] [data-tour="contract-open"]')
      .first();
    await open301Btn.click();
    await expect(page).toHaveURL(/\/app\/hop-dong\//);
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-contract-status");

    // Bước 5: contract-parties
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-contract-parties");

    // Nếu Phòng 301 đang ở trạng thái chờ ký thì kiểm tra luôn hộp thoại ký (KHÔNG gửi bước ký!)
    const hasConfirmSign = await page.locator('[data-tour="confirm-sign"]').isVisible().catch(() => false);
    if (hasConfirmSign) {
      await popup.locator('[data-tour-action="next"]').click();
      await expect(popup).toHaveAttribute("data-tour-step", "tenant-confirm-sign");

      await page.locator('[data-tour="confirm-sign"]').click();
      await expect(popup).toHaveAttribute("data-tour-step", "tenant-stepup-otp-tab");

      await page.locator('[data-tour="stepup-otp-tab"]').click();
      await expect(popup).toHaveAttribute("data-tour-step", "tenant-stepup-otp-input");

      await popup.locator('[data-tour-action="next"]').click();
      await expect(popup).toHaveAttribute("data-tour-step", "tenant-stepup-submit");
      await expect(popup.locator('[data-tour-action="next"]')).toBeDisabled();
      await expect(popup.locator('[data-tour-manual-hint="1"]')).toContainText(
        "Bấm nút được tô sáng để thực hiện",
      );
    }

    // 6. Nhấn Esc -> mở hộp xác nhận nội tuyến (không window.confirm), bấm "Tiếp tục xem" quay lại
    await page.keyboard.press("Escape");
    const exitDialog = page.locator('[data-tour-popup="confirm-exit"]');
    await expect(exitDialog).toBeVisible();
    await exitDialog.getByRole("button", { name: "Tiếp tục xem" }).click();
    await expect(popup).toBeVisible();

    // 7. Bấm "Bỏ qua" -> đóng tour, tải lại trang /app không tự hiện nữa
    await popup.locator('[data-tour-action="skip"]').click();
    await expect(popup).toHaveCount(0);

    const savedStatus = await page.evaluate(() => window.localStorage.getItem("rentflow.tour.tenant.v1"));
    expect(savedStatus).toBe("skipped");

    await page.goto("/app");
    await expect(page.locator('[data-tour="dashboard-stats"]')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-tour-popup="1"]')).toHaveCount(0);

    // 8. Sự kiện window "rentflow:tour-start" mở lại tour từ bước 1
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("rentflow:tour-start"));
    });
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-dashboard-stats");
  });

  test("chủ nhà: tự mở tour chủ nhà, đi xuyên trang sang Phòng 402 và bấm đúng tab để tự chuyển bước", async ({
    page,
  }) => {
    await loginViaUi(page, LANDLORD);

    const popup = page.locator('[data-tour-popup="1"]');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-dashboard-stats");

    // Bước 2: nút tạo hợp đồng (info)
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-create-contract");

    // Bước 3: mở Phòng 402 (click, safeAutoClick)
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-open-402");

    // "Tiếp theo" bấm hộ để sang trang chi tiết Phòng 402
    await popup.locator('[data-tour-action="next"]').click();
    await expect(page).toHaveURL(/\/app\/hop-dong\//);
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-contract-status");

    // Bước 5: bấm TRỰC TIẾP tab Tiền thuê -> tự chuyển sang bước tiếp theo
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-tab-rent");
    await page.locator('[data-tour="tab-tien-thue"]').click();

    // Nếu kỳ quá hạn còn nút Gia hạn -> hiện landlord-extend-due; nếu Phòng 402 đã kết thúc -> hiện fallback "Không tìm thấy bước này"
    const extendOrMissing = page.locator(
      '[data-tour-step="landlord-extend-due"], [data-tour-popup="missing"]',
    );
    await expect(extendOrMissing).toBeVisible({ timeout: 12000 });

    if (await page.locator('[data-tour-popup="missing"]').isVisible()) {
      await page.locator('[data-tour-popup="missing"]').getByRole("button", { name: "Bỏ qua bước" }).click();
    } else {
      await popup.locator('[data-tour-action="next"]').click();
    }

    // Bước 7: tab Tiền cọc -> bấm trực tiếp tab -> sang bước 8 (tab Hoàn cọc)
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-tab-deposit");
    await page.locator('[data-tour="tab-tien-coc"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-tab-refund");

    // Bước 8 -> 9 (refund-action) -> 10 (tab-bang-chung) -> 11 (nav-tour) -> Hoàn tất
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-refund-action");
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-tab-proof");
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "landlord-nav-tour");
    await expect(popup.locator('[data-tour-action="next"]')).toHaveText("Hoàn tất");
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveCount(0);

    const completed = await page.evaluate(() => window.localStorage.getItem("rentflow.tour.landlord.v1"));
    expect(completed).toBe("completed");
  });

  test("di động 390x844: popup thành tấm đáy màn hình, lỗ sáng quanh phần tử, không tràn ngang", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUi(page, TENANT1);

    const popup = page.locator('[data-tour-popup="1"]');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute("data-tour-placement", "sheet");
    await expect(page.locator('[data-tour-spotlight="1"]')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);

    // Chuyển bước và bỏ qua hoạt động trên mobile
    await popup.locator('[data-tour-action="next"]').click();
    await expect(popup).toHaveAttribute("data-tour-step", "tenant-contract-list");
    await popup.locator('[data-tour-action="skip"]').click();
    await expect(popup).toHaveCount(0);
  });
});
