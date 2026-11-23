import { ok, withApi } from "@/lib/api/http";
import { recheckPayment } from "@/domain/payments/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApi<RouteContext>(async (_request, context) => {
  const { id: paymentId } = await context.params;

  const payment = await recheckPayment(paymentId);

  return ok(payment, 200);
});
