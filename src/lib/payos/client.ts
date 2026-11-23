import { PayOS } from "@payos/node";
import type {
  CreatePaymentLinkRequest,
  CreatePaymentLinkResponse,
  PaymentLink,
} from "@payos/node/lib/resources/v2/payment-requests/payment-requests";
import type {
  Webhook,
  WebhookData,
  ConfirmWebhookResponse,
} from "@payos/node/lib/resources/webhooks/webhook";
import { WebhookError, PayOSError } from "@payos/node/lib/core/error";

export { WebhookError, PayOSError };
export type {
  CreatePaymentLinkRequest,
  CreatePaymentLinkResponse,
  PaymentLink,
  Webhook,
  WebhookData,
  ConfirmWebhookResponse,
};

export type PaymentMode = "payos" | "simulated" | "both";

export class PayOSNotConfiguredError extends Error {
  constructor(message = "payOS credentials are not configured") {
    super(message);
    this.name = "PayOSNotConfiguredError";
  }
}

let cachedClient: PayOS | null = null;

/**
 * Kiểm tra xem các biến môi trường cấu hình payOS đã được cung cấp đầy đủ hay chưa.
 */
export function isPayOSConfigured(): boolean {
  return Boolean(
    process.env.PAYOS_CLIENT_ID &&
      process.env.PAYOS_API_KEY &&
      process.env.PAYOS_CHECKSUM_KEY,
  );
}

/**
 * Đọc chế độ thanh toán từ biến môi trường PAYMENT_MODE.
 * Giá trị hợp lệ: "payos" | "simulated" | "both" (mặc định "both").
 */
export function getPaymentMode(): PaymentMode {
  const mode = process.env.PAYMENT_MODE?.toLowerCase();
  if (mode === "payos" || mode === "simulated" || mode === "both") {
    return mode;
  }
  return "both";
}

/**
 * Khởi tạo lười (lazy initialization) client payOS.
 * Ứng dụng vẫn import và chạy bình thường khi chưa có key payOS trong môi trường.
 * Chỉ ném lỗi PayOSNotConfiguredError khi thực sự gọi tới API payOS mà thiếu key.
 */
export function getPayOSClient(): PayOS {
  if (cachedClient) {
    return cachedClient;
  }

  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw new PayOSNotConfiguredError(
      "Missing payOS credentials: PAYOS_CLIENT_ID, PAYOS_API_KEY, and PAYOS_CHECKSUM_KEY are required.",
    );
  }

  cachedClient = new PayOS({
    clientId,
    apiKey,
    checksumKey,
  });

  return cachedClient;
}

/**
 * Tạo link thanh toán VietQR qua payOS SDK.
 */
export async function createPayOSPaymentLink(
  request: CreatePaymentLinkRequest,
): Promise<CreatePaymentLinkResponse> {
  const client = getPayOSClient();
  return client.paymentRequests.create(request);
}

/**
 * Xác thực webhook gửi đến từ payOS bằng SDK.
 * Bắt buộc verify chữ ký bằng `webhooks.verify`. Ném WebhookError nếu chữ ký sai hoặc dữ liệu bị sửa đổi.
 */
export async function verifyPayOSWebhook(webhook: Webhook): Promise<WebhookData> {
  const client = getPayOSClient();
  return client.webhooks.verify(webhook);
}

/**
 * Tra cứu thông tin thanh toán (đối soát) qua API payOS theo orderCode.
 */
export async function getPayOSPaymentLink(orderCode: number): Promise<PaymentLink> {
  const client = getPayOSClient();
  return client.paymentRequests.get(orderCode);
}

/**
 * Xác nhận webhook URL với payOS qua SDK.
 */
export async function confirmPayOSWebhookUrl(
  webhookUrl: string,
): Promise<ConfirmWebhookResponse> {
  const client = getPayOSClient();
  return client.webhooks.confirm(webhookUrl);
}

/**
 * Tạo chữ ký webhook mẫu theo đúng thuật toán SDK payOS để phục vụ kiểm thử
 * khi chưa có key thật hoặc môi trường local.
 */
export async function generateTestWebhookSignature(
  data: Record<string, unknown>,
  checksumKey: string,
): Promise<string> {
  const testClient = new PayOS({
    clientId: "test_client_id",
    apiKey: "test_api_key",
    checksumKey,
  });
  const sig = await testClient.crypto.createSignatureFromObj(data, checksumKey);
  if (!sig) {
    throw new Error("Failed to generate test signature");
  }
  return sig;
}

/**
 * Reset client cache phục vụ unit test.
 */
export function resetPayOSClientForTesting(): void {
  cachedClient = null;
}
