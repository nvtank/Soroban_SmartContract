import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/http";
import {
  createPayOSPaymentLink,
  getPayOSClient,
  getPaymentMode,
  isPayOSConfigured,
  verifyPayOSWebhook,
  type Webhook,
  type WebhookData,
} from "@/lib/payos/client";
import { assertTransition, PAYMENT_TRANSITIONS } from "@/domain/states";
import type { PaymentDto, PaymentProvider } from "@/domain/dto";
import {
  classifyPayment,
  computePaymentRefHash,
  formatPaymentDescription,
  generateOrderCode,
  generatePaymentRefSalt,
  getExpectedPaymentAmount,
} from "./rules";
import {
  getDefaultPaymentRepository,
  type PaymentRepository,
} from "./repository";
import { callSettlePayment, type SettlePaymentFn } from "./settlement-adapter";
import {
  type CreateDepositPaymentInput,
  type CreateRentPaymentInput,
  paymentRowToDto,
  type SimulateConfirmInput,
  type SimulateFailInput,
} from "./types";

export interface PaymentServiceOptions {
  repo?: PaymentRepository;
  settlePaymentFn?: SettlePaymentFn;
}

/**
 * Tạo yêu cầu thanh toán tiền cọc.
 * Không tự động ghi nhận thành công; trạng thái khởi tạo luôn là PENDING.
 */
export async function createDepositPayment(
  input: CreateDepositPaymentInput,
  options?: PaymentServiceOptions,
): Promise<PaymentDto> {
  const repo = options?.repo ?? (await getDefaultPaymentRepository());
  const contract = await repo.getContract(input.contractId);

  if (!contract) {
    throw new ApiError("NOT_FOUND", undefined, "Hợp đồng không tồn tại");
  }

  if (contract.status === "CANCELLED" || contract.status === "ENDED") {
    throw new ApiError("INVALID_TRANSITION", undefined, "Hợp đồng đã kết thúc hoặc bị hủy");
  }

  // Kiểm tra quyền (TASK mục 5): Chỉ người thuê của hợp đồng tạo thanh toán
  if (!input.user) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Vui lòng đăng nhập để tạo thanh toán cọc");
  }

  if (input.user.role !== "ADMIN_DEMO" && input.user.id !== contract.tenant_id) {
    throw new ApiError("FORBIDDEN", undefined, "Chỉ người thuê của hợp đồng mới có quyền tạo thanh toán");
  }

  const deposit = await repo.getDeposit(input.contractId);
  if (deposit && deposit.status === "RECORDED") {
    throw new ApiError("INVALID_TRANSITION", undefined, "Tiền cọc đã được ghi nhận trước đó");
  }
  if (deposit && (deposit.status === "REFUNDED" || deposit.status === "DEDUCTED")) {
    throw new ApiError("INVALID_TRANSITION", undefined, "Tiền cọc đã được giải ngân hoặc khấu trừ");
  }

  // Kiểm tra tạo trùng khi đang có payment PENDING (TASK mục 6)
  const existingPending = await repo.getPendingPayment(contract.id, "DEPOSIT");
  if (existingPending) {
    return paymentRowToDto(existingPending);
  }

  const mode = getPaymentMode();
  let provider: PaymentProvider = input.provider ?? "PAYOS";

  if (provider === "SIMULATED" && mode === "payos") {
    throw new ApiError("FORBIDDEN", undefined, "Chế độ thanh toán mô phỏng không được kích hoạt");
  }
  if (provider === "PAYOS" && mode === "simulated") {
    throw new ApiError("FORBIDDEN", undefined, "Cổng thanh toán payOS không được kích hoạt");
  }

  // Tự động chuyển sang mô phỏng nếu chưa cấu hình key payOS ở chế độ both
  if (provider === "PAYOS" && !isPayOSConfigured()) {
    if (mode === "payos") {
      throw new ApiError("INTERNAL_ERROR", undefined, "Cổng payOS chưa được cấu hình khóa API");
    }
    provider = "SIMULATED";
  }

  const businessAmount = contract.deposit_amount;
  const expectedAmount = getExpectedPaymentAmount(businessAmount, provider);
  const orderCode = generateOrderCode();
  const salt = generatePaymentRefSalt();
  computePaymentRefHash(salt, provider, orderCode);

  let qrData: string | null = null;
  let checkoutUrl: string | null = null;
  const isSimulated = provider === "SIMULATED";

  if (provider === "PAYOS") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = input.returnUrl || `${appUrl}/app/hop-dong/${contract.id}?payment=success`;
    const cancelUrl = input.cancelUrl || `${appUrl}/app/hop-dong/${contract.id}?payment=cancel`;
    const description = formatPaymentDescription("DEPOSIT", orderCode);

    try {
      const payosLink = await createPayOSPaymentLink({
        orderCode,
        amount: Number(expectedAmount),
        description,
        returnUrl,
        cancelUrl,
      });
      qrData = payosLink.qrCode;
      checkoutUrl = payosLink.checkoutUrl;
    } catch (error) {
      console.error("[payments] createPayOSPaymentLink error:", error);
      throw new ApiError("INTERNAL_ERROR", undefined, "Không thể tạo link thanh toán VietQR qua payOS");
    }
  } else {
    // Chế độ mô phỏng
    qrData = `MOCK_VIETQR:DEPOSIT:${orderCode}:${expectedAmount}`;
  }

  const createdRow = await repo.createPayment({
    id: randomUUID(),
    contract_id: contract.id,
    kind: "DEPOSIT",
    period_no: null,
    business_amount: businessAmount,
    expected_amount: expectedAmount,
    paid_amount: BigInt(0),
    provider,
    order_code: BigInt(orderCode),
    status: "PENDING",
    qr_data: qrData,
    checkout_url: checkoutUrl,
    is_simulated: isSimulated,
    payment_ref_salt: salt,
  });

  return paymentRowToDto(createdRow);
}

/**
 * Tạo yêu cầu thanh toán tiền thuê theo kỳ.
 */
export async function createRentPayment(
  input: CreateRentPaymentInput,
  options?: PaymentServiceOptions,
): Promise<PaymentDto> {
  const repo = options?.repo ?? (await getDefaultPaymentRepository());
  const contract = await repo.getContract(input.contractId);

  if (!contract) {
    throw new ApiError("NOT_FOUND", undefined, "Hợp đồng không tồn tại");
  }

  if (contract.status === "CANCELLED" || contract.status === "ENDED") {
    throw new ApiError("INVALID_TRANSITION", undefined, "Hợp đồng đã kết thúc hoặc bị hủy");
  }

  // Kiểm tra quyền (TASK mục 5): Chỉ người thuê của hợp đồng tạo thanh toán
  if (!input.user) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Vui lòng đăng nhập để tạo thanh toán tiền thuê");
  }

  if (input.user.role !== "ADMIN_DEMO" && input.user.id !== contract.tenant_id) {
    throw new ApiError("FORBIDDEN", undefined, "Chỉ người thuê của hợp đồng mới có quyền tạo thanh toán");
  }

  const period = await repo.getRentPeriod(input.contractId, input.periodNo);
  if (!period) {
    throw new ApiError("NOT_FOUND", undefined, `Kỳ thuê số ${input.periodNo} không tồn tại`);
  }

  if (period.status === "PAID") {
    throw new ApiError("INVALID_TRANSITION", undefined, `Kỳ thuê số ${input.periodNo} đã được thanh toán đủ`);
  }

  // Kiểm tra tạo trùng khi đang có payment PENDING (TASK mục 6)
  const existingPending = await repo.getPendingPayment(contract.id, "RENT", input.periodNo);
  if (existingPending) {
    return paymentRowToDto(existingPending);
  }

  const mode = getPaymentMode();
  let provider: PaymentProvider = input.provider ?? "PAYOS";

  if (provider === "SIMULATED" && mode === "payos") {
    throw new ApiError("FORBIDDEN", undefined, "Chế độ thanh toán mô phỏng không được kích hoạt");
  }
  if (provider === "PAYOS" && mode === "simulated") {
    throw new ApiError("FORBIDDEN", undefined, "Cổng thanh toán payOS không được kích hoạt");
  }

  if (provider === "PAYOS" && !isPayOSConfigured()) {
    if (mode === "payos") {
      throw new ApiError("INTERNAL_ERROR", undefined, "Cổng payOS chưa được cấu hình khóa API");
    }
    provider = "SIMULATED";
  }

  const remainingRent = period.amount_due - period.amount_paid;
  const zero = BigInt(0);
  const businessAmount = (remainingRent > zero ? remainingRent : zero) + period.late_fee;
  const expectedAmount = getExpectedPaymentAmount(businessAmount, provider);
  const orderCode = generateOrderCode();
  const salt = generatePaymentRefSalt();
  computePaymentRefHash(salt, provider, orderCode);

  let qrData: string | null = null;
  let checkoutUrl: string | null = null;
  const isSimulated = provider === "SIMULATED";

  if (provider === "PAYOS") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = input.returnUrl || `${appUrl}/app/hop-dong/${contract.id}?payment=success`;
    const cancelUrl = input.cancelUrl || `${appUrl}/app/hop-dong/${contract.id}?payment=cancel`;
    const description = formatPaymentDescription("RENT", orderCode);

    try {
      const payosLink = await createPayOSPaymentLink({
        orderCode,
        amount: Number(expectedAmount),
        description,
        returnUrl,
        cancelUrl,
      });
      qrData = payosLink.qrCode;
      checkoutUrl = payosLink.checkoutUrl;
    } catch (error) {
      console.error("[payments] createPayOSPaymentLink error:", error);
      throw new ApiError("INTERNAL_ERROR", undefined, "Không thể tạo link thanh toán VietQR qua payOS");
    }
  } else {
    qrData = `MOCK_VIETQR:RENT:${orderCode}:${expectedAmount}`;
  }

  const createdRow = await repo.createPayment({
    id: randomUUID(),
    contract_id: contract.id,
    kind: "RENT",
    period_no: input.periodNo,
    business_amount: businessAmount,
    expected_amount: expectedAmount,
    paid_amount: BigInt(0),
    provider,
    order_code: BigInt(orderCode),
    status: "PENDING",
    qr_data: qrData,
    checkout_url: checkoutUrl,
    is_simulated: isSimulated,
    payment_ref_salt: salt,
  });

  return paymentRowToDto(createdRow);
}

export type ProcessWebhookResult = {
  success: boolean;
  isTest?: boolean;
  alreadyProcessed?: boolean;
  payment?: PaymentDto;
  message?: string;
};

/**
 * Xử lý webhook từ payOS.
 * - Verify chữ ký bắt buộc bằng SDK. Chữ ký sai hoặc dữ liệu hỏng trả 400.
 * - Idempotent bằng bảng payment_events unique. Trùng trả 200 và bỏ qua.
 * - Hỗ trợ webhook test của payOS khi xác thực URL (orderCode 123 hoặc VQRIO123).
 * - Sau khi xác định trạng thái, gọi settlePayment của C.
 */
export async function processPayOSWebhook(
  webhookBody: Webhook,
  options?: PaymentServiceOptions,
): Promise<ProcessWebhookResult> {
  const repo = options?.repo ?? (await getDefaultPaymentRepository());

  let verifiedData: WebhookData;
  try {
    verifiedData = await verifyPayOSWebhook(webhookBody);
  } catch (error) {
    console.warn("[payments] Webhook signature verification failed:", error);
    throw new ApiError("VALIDATION_ERROR", undefined, "Chữ ký webhook payOS không hợp lệ");
  }

  // Kiểm tra gói tin test của payOS khi confirm webhook URL
  const isTestWebhook =
    verifiedData.orderCode === 123 ||
    verifiedData.description === "VQRIO123" ||
    verifiedData.description?.toLowerCase().includes("test");

  const payment = await repo.getPaymentByOrderCode(verifiedData.orderCode);

  if (!payment) {
    if (isTestWebhook) {
      return {
        success: true,
        isTest: true,
        message: "Webhook kiểm tra từ payOS đã được xác thực thành công",
      };
    }
    throw new ApiError("NOT_FOUND", undefined, `Không tìm thấy giao dịch với orderCode=${verifiedData.orderCode}`);
  }

  // Idempotency: khóa sự kiện duy nhất
  const eventReference = verifiedData.reference || verifiedData.paymentLinkId || "default";
  const eventKey = `payos_${verifiedData.orderCode}_${eventReference}`;

  const isRecorded = await repo.recordPaymentEvent({
    provider: "PAYOS",
    order_code: BigInt(verifiedData.orderCode),
    event_key: eventKey,
  });

  if (!isRecorded) {
    // Đã xử lý sự kiện này trước đó, lấy trạng thái mới nhất từ DB
    const latestPayment = (await repo.getPaymentByOrderCode(verifiedData.orderCode)) ?? payment;
    return {
      success: true,
      alreadyProcessed: true,
      payment: paymentRowToDto(latestPayment),
      message: "Webhook đã được xử lý trước đó (idempotent)",
    };
  }

  if (verifiedData.code !== "00") {
    const updated = await repo.updatePayment(payment.id, {
      status: "FAILED",
    });
    return {
      success: false,
      payment: paymentRowToDto(updated),
      message: "Giao dịch thanh toán thất bại từ cổng payOS",
    };
  }

  const paidAmount = BigInt(verifiedData.amount);
  const classification = classifyPayment(payment.expected_amount, paidAmount);

  const updatedPayment = await repo.updatePayment(payment.id, {
    paid_amount: paidAmount,
    status: classification.status,
  });

  // Gọi settlePayment của Agent C sau khi đã xác định trạng thái
  // P0 TRUNG THỰC (TASK mục 2): Không nuốt lỗi; nếu settle lỗi thì xóa event_key và ném lỗi để webhook retry
  try {
    await callSettlePayment(repo.getUnderlyingDb(), payment.id, options?.settlePaymentFn);
  } catch (settleError) {
    await repo.deletePaymentEvent("PAYOS", eventKey);
    console.error("[payments] SettlePayment failed in processPayOSWebhook:", settleError);
    throw new ApiError(
      "INTERNAL_ERROR",
      undefined,
      `Quyết toán thanh toán thất bại, webhook sẽ được thử lại: ${
        settleError instanceof Error ? settleError.message : String(settleError)
      }`,
    );
  }

  return {
    success: true,
    payment: paymentRowToDto(updatedPayment),
  };
}

/**
 * Giả lập xác nhận thanh toán (Simulate Confirm).
 * Chỉ chạy khi PAYMENT_MODE cho phép ("simulated" hoặc "both").
 * Luôn gắn nhãn is_simulated=true.
 * Hỗ trợ các tình huống: đủ (FULL), thiếu (UNDERPAID), thừa (OVERPAID).
 */
export async function simulatePaymentConfirm(
  input: SimulateConfirmInput,
  options?: PaymentServiceOptions,
): Promise<PaymentDto> {
  const mode = getPaymentMode();
  if (mode === "payos") {
    throw new ApiError("FORBIDDEN", undefined, "Chế độ mô phỏng hiện đang tắt theo cấu hình PAYMENT_MODE");
  }

  const repo = options?.repo ?? (await getDefaultPaymentRepository());
  const payment = await repo.getPaymentById(input.paymentId);

  if (!payment) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy giao dịch thanh toán");
  }

  const contract = await repo.getContract(payment.contract_id);
  if (!contract) {
    throw new ApiError("NOT_FOUND", undefined, "Hợp đồng không tồn tại");
  }

  if (!input.user) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Vui lòng đăng nhập để thực hiện mô phỏng");
  }

  if (
    input.user.role !== "ADMIN_DEMO" &&
    input.user.id !== contract.tenant_id &&
    input.user.id !== contract.landlord_id
  ) {
    throw new ApiError("FORBIDDEN", undefined, "Bạn không có quyền can thiệp giao dịch này");
  }

  // Xác định số tiền giả lập
  let simulatedPaidAmount: bigint;
  if (input.amount !== undefined && input.amount !== null && input.amount !== "") {
    simulatedPaidAmount = BigInt(input.amount);
  } else if (input.scenario === "UNDERPAID") {
    const thousand = BigInt(1000);
    simulatedPaidAmount = payment.expected_amount > thousand ? payment.expected_amount - thousand : BigInt(1);
  } else if (input.scenario === "OVERPAID") {
    simulatedPaidAmount = payment.expected_amount + BigInt(1000);
  } else {
    simulatedPaidAmount = payment.expected_amount; // FULL
  }

  const classification = classifyPayment(payment.expected_amount, simulatedPaidAmount);

  assertTransition(PAYMENT_TRANSITIONS, payment.status, classification.status);

  const eventKey = `simulated_confirm_${payment.id}_${classification.status}_${Date.now()}_${Math.random()}`;
  await repo.recordPaymentEvent({
    provider: "SIMULATED",
    order_code: payment.order_code,
    event_key: eventKey,
  });

  const updatedPayment = await repo.updatePayment(payment.id, {
    paid_amount: simulatedPaidAmount,
    status: classification.status,
    is_simulated: true,
  });

  // Sau khi xác định trạng thái, gọi settlePayment của C
  await callSettlePayment(repo.getUnderlyingDb(), payment.id, options?.settlePaymentFn);

  return paymentRowToDto(updatedPayment);
}

/**
 * Giả lập thanh toán thất bại (Simulate Fail).
 */
export async function simulatePaymentFail(
  input: SimulateFailInput,
  options?: PaymentServiceOptions,
): Promise<PaymentDto> {
  const mode = getPaymentMode();
  if (mode === "payos") {
    throw new ApiError("FORBIDDEN", undefined, "Chế độ mô phỏng hiện đang tắt theo cấu hình PAYMENT_MODE");
  }

  const repo = options?.repo ?? (await getDefaultPaymentRepository());
  const payment = await repo.getPaymentById(input.paymentId);

  if (!payment) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy giao dịch thanh toán");
  }

  const contract = await repo.getContract(payment.contract_id);
  if (!contract) {
    throw new ApiError("NOT_FOUND", undefined, "Hợp đồng không tồn tại");
  }

  if (!input.user) {
    throw new ApiError("UNAUTHENTICATED", undefined, "Vui lòng đăng nhập để thực hiện mô phỏng");
  }

  if (
    input.user.role !== "ADMIN_DEMO" &&
    input.user.id !== contract.tenant_id &&
    input.user.id !== contract.landlord_id
  ) {
    throw new ApiError("FORBIDDEN", undefined, "Bạn không có quyền can thiệp giao dịch này");
  }

  assertTransition(PAYMENT_TRANSITIONS, payment.status, "FAILED");

  const eventKey = `simulated_fail_${payment.id}_${Date.now()}`;
  await repo.recordPaymentEvent({
    provider: "SIMULATED",
    order_code: payment.order_code,
    event_key: eventKey,
  });

  const updatedPayment = await repo.updatePayment(payment.id, {
    status: "FAILED",
    is_simulated: true,
  });

  return paymentRowToDto(updatedPayment);
}

/**
 * "Kiểm tra lại": Đối soát trực tiếp qua API payOS (paymentRequests.get).
 * Sử dụng khi thanh toán đã hoàn thành nhưng webhook chưa tới (TASK mục 1 & 6).
 * Hỗ trợ thử lại quyết toán nếu trước đó bị lỗi (TASK mục 2).
 */
export async function recheckPayment(
  paymentId: string,
  options?: PaymentServiceOptions,
): Promise<PaymentDto> {
  const repo = options?.repo ?? (await getDefaultPaymentRepository());
  const payment = await repo.getPaymentById(paymentId);

  if (!payment) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy thông tin giao dịch thanh toán");
  }

  // Nếu giao dịch đã thất bại hoặc hết hạn:
  if (payment.status === "FAILED" || payment.status === "EXPIRED") {
    return paymentRowToDto(payment);
  }

  // Nếu giao dịch đã CONFIRMED hoặc OVERPAID nhưng phát hiện settlement trước đó bị lỗi
  // (ví dụ: deposit vẫn UNPAID, hoặc rent period chưa PAID): thử quyết toán lại!
  if (payment.status === "CONFIRMED" || payment.status === "OVERPAID") {
    let needsSettle = false;
    if (payment.kind === "DEPOSIT") {
      const deposit = await repo.getDeposit(payment.contract_id);
      if (deposit && deposit.status === "UNPAID") {
        needsSettle = true;
      }
    } else if (payment.kind === "RENT" && payment.period_no !== null) {
      const period = await repo.getRentPeriod(payment.contract_id, payment.period_no);
      if (period && period.status !== "PAID") {
        needsSettle = true;
      }
    }

    if (needsSettle) {
      await callSettlePayment(repo.getUnderlyingDb(), payment.id, options?.settlePaymentFn);
    }
    return paymentRowToDto(payment);
  }

  if (payment.provider === "PAYOS") {
    if (!isPayOSConfigured()) {
      return paymentRowToDto(payment);
    }

    try {
      const client = getPayOSClient();
      const linkInfo = await client.paymentRequests.get(Number(payment.order_code));

      if (linkInfo.status === "PAID") {
        const paidAmount = BigInt(linkInfo.amountPaid);
        const classification = classifyPayment(payment.expected_amount, paidAmount);

        const eventKey = `recheck_payos_${payment.order_code}_${paidAmount}`;
        await repo.recordPaymentEvent({
          provider: "PAYOS",
          order_code: payment.order_code,
          event_key: eventKey,
        });

        const updated = await repo.updatePayment(payment.id, {
          paid_amount: paidAmount,
          status: classification.status,
        });

        await callSettlePayment(repo.getUnderlyingDb(), payment.id, options?.settlePaymentFn);
        return paymentRowToDto(updated);
      } else if (linkInfo.status === "UNDERPAID") {
        const paidAmount = BigInt(linkInfo.amountPaid);
        const updated = await repo.updatePayment(payment.id, {
          paid_amount: paidAmount,
          status: "UNDERPAID",
        });
        return paymentRowToDto(updated);
      } else if (linkInfo.status === "CANCELLED" || linkInfo.status === "FAILED") {
        const updated = await repo.updatePayment(payment.id, {
          status: "FAILED",
        });
        return paymentRowToDto(updated);
      } else if (linkInfo.status === "EXPIRED") {
        const updated = await repo.updatePayment(payment.id, {
          status: "EXPIRED",
        });
        return paymentRowToDto(updated);
      }
    } catch (error) {
      console.warn("[payments] recheckPayment payOS API error:", error);
    }
  }

  return paymentRowToDto(payment);
}

/**
 * Lấy chi tiết thông tin thanh toán theo ID.
 */
export async function getPaymentById(
  paymentId: string,
  options?: PaymentServiceOptions,
): Promise<PaymentDto> {
  const repo = options?.repo ?? (await getDefaultPaymentRepository());
  const payment = await repo.getPaymentById(paymentId);
  if (!payment) {
    throw new ApiError("NOT_FOUND", undefined, "Không tìm thấy giao dịch thanh toán");
  }
  return paymentRowToDto(payment);
}
