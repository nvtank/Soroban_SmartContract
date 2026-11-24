import { z } from "zod";
import { ok, withApi, ApiError } from "@/lib/api/http";
import { getSessionUser } from "@/domain/payments/auth-helper";
import { simulatePaymentConfirm } from "@/domain/payments/service";

const SimulateConfirmSchema = z
  .object({
    scenario: z.enum(["FULL", "UNDERPAID", "OVERPAID"]).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
  })
  .optional()
  .default({});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApi<RouteContext>(async (request, context) => {
  const { id: paymentId } = await context.params;

  let bodyData: z.infer<typeof SimulateConfirmSchema> = {};
  const text = await request.text();
  if (text.trim().length > 0) {
    try {
      const json = JSON.parse(text);
      const parsed = SimulateConfirmSchema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_ERROR", z.flattenError(parsed.error));
      }
      bodyData = parsed.data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("VALIDATION_ERROR", undefined, "Dữ liệu JSON không hợp lệ");
    }
  }

  // Yêu cầu quyền người dùng hợp lệ
  const user = await getSessionUser(request, true);

  const updated = await simulatePaymentConfirm({
    paymentId,
    user,
    scenario: bodyData.scenario,
    amount: bodyData.amount,
  });

  return ok(updated, 200);
});
