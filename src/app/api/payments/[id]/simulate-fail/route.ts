import { z } from "zod";
import { ok, withApi, ApiError } from "@/lib/api/http";
import { getSessionUser } from "@/domain/payments/auth-helper";
import { simulatePaymentFail } from "@/domain/payments/service";

const SimulateFailSchema = z
  .object({
    reason: z.string().optional(),
  })
  .optional()
  .default({});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApi<RouteContext>(async (request, context) => {
  const { id: paymentId } = await context.params;

  let bodyData: z.infer<typeof SimulateFailSchema> = {};
  const text = await request.text();
  if (text.trim().length > 0) {
    try {
      const json = JSON.parse(text);
      const parsed = SimulateFailSchema.safeParse(json);
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

  const updated = await simulatePaymentFail({
    paymentId,
    user,
    reason: bodyData.reason,
  });

  return ok(updated, 200);
});
