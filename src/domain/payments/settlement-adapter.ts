/**
 * Adapter gọi hàm settlePayment của Agent C.
 *
 * Theo CONTRACTS mục 7:
 * `settlePayment(db, paymentId: string): Promise<void>` là hàm idempotent do C sở hữu.
 * E gọi sau khi đã xác định trạng thái payment (CONFIRMED, UNDERPAID, OVERPAID).
 *
 * Nếu module của C chưa có trên nhánh hiện tại, adapter hỗ trợ dependency injection
 * hoặc bỏ qua an toàn mà không làm sập ứng dụng.
 */

export type SettlePaymentFn = (db: unknown, paymentId: string) => Promise<void>;

export async function callSettlePayment(
  db: unknown,
  paymentId: string,
  injectedSettleFn?: SettlePaymentFn,
): Promise<void> {
  if (injectedSettleFn) {
    await injectedSettleFn(db, paymentId);
    return;
  }

  try {
    const mod = await import("@/domain/contracts/settlement");
    if (typeof mod.settlePayment === "function") {
      await mod.settlePayment(db as Parameters<typeof mod.settlePayment>[0], paymentId);
    }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (
      err?.code === "ERR_MODULE_NOT_FOUND" ||
      err?.message?.includes("Cannot find module") ||
      err?.message?.includes("Failed to resolve import")
    ) {
      // Module của Agent C chưa được merge vào nhánh này. Chấp nhận theo quy ước CONTRACTS.
      console.warn(
        `[payments] Module @/domain/contracts/settlement chưa sẵn sàng trên nhánh hiện tại. Bỏ qua settlePayment cho paymentId=${paymentId}`,
      );
      return;
    }
    throw error;
  }
}
