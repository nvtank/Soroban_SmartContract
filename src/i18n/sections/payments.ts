/**
 * Chuỗi văn bản và thông báo tiếng Việt cho phân hệ Thanh toán (Agent E).
 *
 * QUY TẮC BẮT BUỘC:
 * - payOS chỉ là cổng tạo mã VietQR thanh toán, không phải tài khoản escrow ngân hàng
 *   và KHÔNG bảo chứng tiền cọc.
 * - Không tự ghi nhận thanh toán thành công khi chưa có xác nhận hợp lệ.
 */

export const paymentsI18n = {
  sectionTitle: "Thanh toán",
  disclaimer:
    "Lưu ý: payOS chỉ là cổng tạo link và mã VietQR thanh toán, không phải tài khoản escrow ngân hàng và không bảo chứng tiền cọc. Trạng thái giữ cọc là mô phỏng trong hệ thống RentFlow.",
  testPaymentNotice: "Số tiền thanh toán thử nghiệm",
  vietQrInstruction: "Quét mã VietQR bằng ứng dụng ngân hàng bất kỳ để thanh toán.",
  orderCodeLabel: "Mã đơn hàng",
  businessAmountLabel: "Số tiền theo hợp đồng",
  expectedAmountLabel: "Số tiền thực thu qua cổng",
  paidAmountLabel: "Số tiền đã thanh toán",
  shortfallLabel: "Số tiền còn thiếu",
  excessLabel: "Số tiền nộp thừa",
  recheckButton: "Kiểm tra lại",
  recheckDescription: "Đối soát trực tiếp với cổng thanh toán khi giao dịch chưa được cập nhật tự động.",
  recheckSuccess: "Đã cập nhật trạng thái thanh toán từ cổng payOS.",
  recheckNoChange: "Trạng thái thanh toán chưa thay đổi trên cổng.",

  simulation: {
    badge: "MÔ PHỎNG",
    title: "Bảng điều khiển thanh toán mô phỏng",
    description: "Công cụ giả lập các tình huống thanh toán phục vụ kiểm thử và trình diễn.",
    scenarioFull: "Giả lập: đã nhận đủ tiền",
    scenarioUnderpaid: "Giả lập: nộp thiếu",
    scenarioOverpaid: "Giả lập: nộp thừa",
    scenarioFailed: "Giả lập: thanh toán thất bại",
    disabledNotice: "Chế độ mô phỏng hiện đang tắt theo cấu hình PAYMENT_MODE.",
  },

  kinds: {
    DEPOSIT: "Tiền cọc",
    RENT: "Tiền thuê kỳ",
  },

  providers: {
    PAYOS: "payOS (VietQR)",
    SIMULATED: "Mô phỏng",
  },

  statuses: {
    PENDING: "Đang chờ thanh toán",
    CONFIRMED: "Đã xác nhận thanh toán",
    UNDERPAID: "Nộp thiếu tiền",
    OVERPAID: "Nộp thừa tiền",
    FAILED: "Thanh toán thất bại",
    EXPIRED: "Hết hạn thanh toán",
  },

  errors: {
    PAYOS_NOT_CONFIGURED: "Cổng thanh toán payOS chưa được cấu hình khóa API.",
    INVALID_WEBHOOK_SIGNATURE: "Chữ ký webhook payOS không hợp lệ.",
    WEBHOOK_DATA_CORRUPTED: "Dữ liệu webhook không toàn vẹn.",
    PAYMENT_NOT_FOUND: "Không tìm thấy thông tin giao dịch thanh toán.",
    CONTRACT_NOT_FOUND: "Không tìm thấy hợp đồng tương ứng.",
    RENT_PERIOD_NOT_FOUND: "Không tìm thấy kỳ thuê tương ứng.",
    PAYMENT_ALREADY_SETTLED: "Giao dịch thanh toán đã được xử lý trước đó.",
    SIMULATION_DISABLED: "Chế độ thanh toán mô phỏng không được phép trong cấu hình hiện tại.",
    INVALID_AMOUNT: "Số tiền thanh toán không hợp lệ.",
    UNAUTHORIZED_PAYMENT: "Bạn không có quyền thực hiện hoặc can thiệp giao dịch này.",
    TENANT_ONLY_ALLOWED: "Chỉ người thuê của hợp đồng mới có quyền tạo yêu cầu thanh toán.",
    PENDING_PAYMENT_EXISTS: "Đã có yêu cầu thanh toán đang chờ xử lý. Vui lòng thanh toán theo mã đã tạo.",
    SETTLEMENT_RETRY_SUCCESS: "Đã quyết toán lại giao dịch thành công.",
    SETTLEMENT_FAILED: "Quyết toán giao dịch thất bại. Vui lòng thử lại sau.",
    UNSUPPORTED_PROVIDER: "Phương thức thanh toán không được hỗ trợ.",
  },
  officialDoc: {
    minAmountNotice: "Hạn mức thanh toán thử nghiệm tối thiểu là 2.000 VNĐ theo tài liệu chính thức payOS (payos.vn/docs).",
    source: "https://payos.vn/docs/",
  },
} as const;

export type PaymentsI18n = typeof paymentsI18n;
