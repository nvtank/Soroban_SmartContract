import { ok, withApi } from "@/lib/api/http";
import { getPaymentById } from "@/domain/payments/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApi<RouteContext>(async (_request, context) => {
  const { id: paymentId } = await context.params;

  const payment = await getPaymentById(paymentId);

  return ok(payment, 200);
});
