"use server";

import { isPayOSConfigured } from "@/lib/payos/client";

/**
 * Kiểm tra xem cổng payOS đã được cấu hình khóa API trên môi trường máy chủ hay chưa.
 */
export async function checkPayOSConfiguredAction(): Promise<boolean> {
  return isPayOSConfigured();
}
