import { defineConfig } from "@playwright/test";
import * as fs from "node:fs";

const defaultChrome = "/run/current-system/sw/bin/google-chrome-stable";
const chromePath =
  process.env.PLAYWRIGHT_CHROME_PATH || (fs.existsSync(defaultChrome) ? defaultChrome : undefined);

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3112";

function buildTourDisabledOrigins(urlString: string): string[] {
  try {
    const parsed = new URL(urlString);
    const origins = new Set<string>([parsed.origin]);
    if (parsed.hostname === "localhost") {
      origins.add(`${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ""}`);
    } else if (parsed.hostname === "127.0.0.1") {
      origins.add(`${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`);
    }
    return [...origins];
  } catch {
    return ["http://localhost:3112", "http://localhost:3111"];
  }
}

/**
 * E2E bấm chuột thật trên giao diện ở chế độ không mock, cần app đang chạy và Supabase local.
 * Chạy: pnpm e2e   (đặt E2E_VIDEO=1 để quay video dự phòng cho buổi trình diễn)
 * Dùng localhost để Passkey khớp tên miền. PLAYWRIGHT_CHROME_PATH để chỉ định trình duyệt Chrome có sẵn.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // mobile-check.spec.ts cần một máy chủ riêng ở chế độ dữ liệu mẫu (cổng 3113); chỉ chạy khi bật cờ này.
  testIgnore: process.env.E2E_MOBILE_MOCK === "1" ? [] : ["**/mobile-check.spec.ts"],
  timeout: 300_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL,
    viewport: { width: 1366, height: 820 },
    // Tắt tự mở tour cho toàn bộ E2E cũ; riêng onboarding-tour.spec.ts ghi đè storageState trống.
    storageState: {
      cookies: [],
      origins: buildTourDisabledOrigins(baseURL).map((origin) => ({
        origin,
        localStorage: [{ name: "rentflow.tour.disabled", value: "1" }],
      })),
    },
    video: process.env.E2E_VIDEO === "1" ? { mode: "on", size: { width: 1366, height: 820 } } : "off",
    launchOptions: {
      executablePath: chromePath,
      slowMo: Number(process.env.E2E_SLOWMO ?? 0),
    },
  },
});
