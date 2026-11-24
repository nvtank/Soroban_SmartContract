import { z } from "zod";
import { ok, withApi, ApiError } from "@/lib/api/http";
import { processPayOSWebhook } from "@/domain/payments/service";
import type { Webhook } from "@/lib/payos/client";

// Webhook schema khớp định dạng từ payOS
const PayOSWebhookSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string(),
    reference: z.string(),
    transactionDateTime: z.string(),
    currency: z.string(),
    paymentLinkId: z.string(),
    code: z.string(),
    desc: z.string(),
    counterAccountBankId: z.string().nullable().optional(),
    counterAccountBankName: z.string().nullable().optional(),
    counterAccountName: z.string().nullable().optional(),
    counterAccountNumber: z.string().nullable().optional(),
    virtualAccountName: z.string().nullable().optional(),
    virtualAccountNumber: z.string().nullable().optional(),
  }),
  signature: z.string(),
});

export const POST = withApi(async (request: Request) => {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", undefined, "Payload JSON không hợp lệ");
  }

  const parsed = PayOSWebhookSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", z.flattenError(parsed.error), "Dữ liệu webhook không đúng định dạng payOS");
  }

  const result = await processPayOSWebhook(parsed.data as Webhook);

  return ok(result, 200);
});
