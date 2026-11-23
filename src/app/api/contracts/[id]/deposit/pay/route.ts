import { z } from "zod";
import { ok, withApi, ApiError } from "@/lib/api/http";
import { getSessionUser } from "@/domain/payments/auth-helper";
import { createDepositPayment } from "@/domain/payments/service";

const PayDepositSchema = z
  .object({
    provider: z.enum(["PAYOS", "SIMULATED"]).optional(),
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .optional()
  .default({});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApi<RouteContext>(async (request, context) => {
  const { id: contractId } = await context.params;

  let bodyData: z.infer<typeof PayDepositSchema> = {};
  const text = await request.text();
  if (text.trim().length > 0) {
    try {
      const json = JSON.parse(text);
      const parsed = PayDepositSchema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_ERROR", z.flattenError(parsed.error));
      }
      bodyData = parsed.data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("VALIDATION_ERROR", undefined, "Dữ liệu JSON không hợp lệ");
    }
  }

  const user = await getSessionUser(request, false);

  const payment = await createDepositPayment({
    contractId,
    user,
    provider: bodyData.provider,
    returnUrl: bodyData.returnUrl,
    cancelUrl: bodyData.cancelUrl,
  });

  return ok(payment, 201);
});
