import { z } from "zod";
import { ok, withApi, ApiError } from "@/lib/api/http";
import { getSessionUser } from "@/domain/payments/auth-helper";
import { createRentPayment } from "@/domain/payments/service";

const PayRentSchema = z
  .object({
    provider: z.enum(["PAYOS", "SIMULATED"]).optional(),
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .optional()
  .default({});

type RouteContext = {
  params: Promise<{ id: string; period: string }>;
};

export const POST = withApi<RouteContext>(async (request, context) => {
  const { id: contractId, period: periodStr } = await context.params;
  const periodNo = parseInt(periodStr, 10);

  if (Number.isNaN(periodNo) || periodNo < 1) {
    throw new ApiError("VALIDATION_ERROR", undefined, "Kỳ thuê phải là số nguyên dương");
  }

  let bodyData: z.infer<typeof PayRentSchema> = {};
  const text = await request.text();
  if (text.trim().length > 0) {
    try {
      const json = JSON.parse(text);
      const parsed = PayRentSchema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_ERROR", z.flattenError(parsed.error));
      }
      bodyData = parsed.data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("VALIDATION_ERROR", undefined, "Dữ liệu JSON không hợp lệ");
    }
  }

  const user = await getSessionUser(request, true);

  const payment = await createRentPayment({
    contractId,
    periodNo,
    user,
    provider: bodyData.provider,
    returnUrl: bodyData.returnUrl,
    cancelUrl: bodyData.cancelUrl,
  });

  return ok(payment, 201);
});
