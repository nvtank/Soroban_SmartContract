export const vi = {
  meta: {
    title: "RentFlow — Giữ cọc công bằng, thu tiền nhà nhẹ nhàng",
    description: "Bản demo bảo chứng tiền cọc (mô phỏng) và thu tiền thuê nhà, ghi bằng chứng trên Stellar Testnet.",
  },
  brand: { name: "RentFlow", tagline: "Giữ cọc công bằng, thu tiền nhà nhẹ nhàng." },
  demo: {
    banner: "Bản demo: ngân hàng và giải ngân là mô phỏng. Blockchain chạy trên Stellar Testnet, không có giá trị tiền thật.",
    mockBadge: "MÔ PHỎNG",
    demoAccount: "Tài khoản demo",
    testPayment: "Số tiền thanh toán thử nghiệm",
  },
  nav: {
    problem: "Vấn đề",
    solution: "Giải pháp",
    howItWorks: "Cách hoạt động",
    blockchain: "Blockchain",
    tryIt: "Dùng thử",
    transparency: "Minh bạch",
    tryDemo: "Dùng thử demo",
  },
  common: {
    loading: "Đang tải…",
    empty: "Chưa có dữ liệu",
    retry: "Thử lại",
    recheck: "Kiểm tra lại",
    unverifiedSource: "Chưa xác minh nguồn",
  },
  onchain: {
    proof: "Bằng chứng on-chain",
    recorded: "ĐÃ GHI NHẬN ON-CHAIN",
    writing: "ĐANG GHI",
    failed: "THẤT BẠI",
    failedAction: "Ghi nhận blockchain thất bại — Thử lại",
    notRecorded: "Chưa ghi nhận on-chain",
  },
  errors: {
    UNAUTHENTICATED: "Vui lòng đăng nhập để tiếp tục.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    NOT_FOUND: "Không tìm thấy dữ liệu.",
    VALIDATION_ERROR: "Thông tin chưa hợp lệ, vui lòng kiểm tra lại.",
    INVALID_TRANSITION: "Không thể thực hiện thao tác ở trạng thái hiện tại.",
    DISPUTE_LOCKED: "Tiền cọc đang bị khóa do có tranh chấp.",
    PAYMENT_NOT_CONFIRMED: "Thanh toán chưa được xác nhận.",
    RATE_LIMITED: "Bạn thao tác quá nhanh, vui lòng thử lại sau.",
    ONCHAIN_FAILED: "Ghi nhận blockchain thất bại.",
    INTERNAL_ERROR: "Đã có lỗi xảy ra, vui lòng thử lại.",
  },
  placeholder: {
    phase: "Giai đoạn 0: khung dự án đã sẵn sàng. Trang chủ sẽ do Agent F xây dựng.",
  },
} as const;

export type ApiErrorCode = keyof typeof vi.errors;
