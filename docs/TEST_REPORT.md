# Báo cáo kiểm thử

Chỉ ghi những gì đã thật sự chạy. Mọi số liệu lấy từ lần chạy cuối trên máy local, Supabase local, Stellar Testnet. Chưa có số đo hiệu năng cho môi trường online.

## 1. Kiểm thử tự động

| Bộ kiểm thử | Kết quả | Lệnh |
|---|---|---|
| Unit và tích hợp (Vitest) | 44 tệp, **315/315 đạt** | `pnpm test` |
| Smart contract (Rust) | **29/29 đạt**, gồm test đối kháng và chuỗi lệnh ngẫu nhiên | `cd contracts/rentflow && cargo test` |
| TypeScript | 0 lỗi | `pnpm typecheck` |
| ESLint | 0 lỗi | `pnpm lint` |
| Build production | Đạt | `pnpm build` |
| Quét bí mật (cây thư mục và lịch sử git) | Sạch | `node scripts/scan-secrets.mjs` |
| Quét dữ liệu cá nhân trong giao dịch on-chain | Sạch | `node scripts/scan-pii.mjs` |

Lưu ý: `pnpm test` có nhiều test xóa và nạp lại dữ liệu trong database local, nên **chạy xong phải chuẩn bị lại dữ liệu demo**. Có khóa an toàn chặn các test này chạy nếu Supabase không phải localhost.

## 2. Chạy thật trên app và Testnet

Hai kịch bản gọi API thật với cookie phiên đã ký: `scripts/e2e-flow.mjs` (luồng chính, nhánh tranh chấp) và `scripts/e2e-extra.mjs` (phạt trễ, nộp thừa, hoàn cọc hai bên, tranh chấp, gia hạn). Cả hai báo đạt toàn bộ.

Giao dịch Stellar Testnet đã **xác nhận** (SUCCESS, hỏi trực tiếp Soroban RPC) cho cả 12 hàm thay đổi trạng thái: `create_contract`, `tenant_confirm`, `record_deposit_paid`, `record_rent_paid`, `mark_overdue`, `extend_due`, `request_refund`, `approve_refund`, `propose_deduction`, `respond_deduction`, `open_dispute`, `resolve_dispute`. Ba hàm chỉ đọc và constructor không phải giao dịch của luồng.

Trạng thái đọc ngược từ contract sau luồng từ chối khấu trừ: hợp đồng Đang hiệu lực, cọc Chờ xử lý tranh chấp, tranh chấp Đang xử lý, số tiền cọc 6.000.000. **Khớp hoàn toàn với database.**

Giao dịch được bọc `FeeBumpTransaction` (CAP-15), tài khoản nền tảng trả phí, đã kiểm tra bao bì giao dịch trên chain.

## 3. Giao diện trình duyệt thật (Chrome)

- Đăng nhập OTP bằng giao diện: đạt.
- Duyệt 10 trang x 3 cỡ màn hình (1440, 1100, 390 pixel) ở chế độ dữ liệu mẫu: không lỗi console, không tràn ngang, banner mô phỏng luôn hiện.
- Duyệt dashboard, chi tiết hợp đồng và các tab của cả hai vai ở chế độ thật: không lỗi.
- Passkey bằng thiết bị Passkey ảo của Chrome: đăng ký đạt, ký xác nhận hợp đồng đạt, mã bước hai là mã thật dùng một lần (không phải mã demo), hợp đồng chuyển sang Đang hiệu lực.

## 4. Bảy tình huống lỗi

Xem bảng chi tiết ở `docs/REQUIREMENTS_CHECK.md` mục 3. Tóm tắt: **4 chạy thật** (ghi Testnet thất bại và thử lại, thanh toán thiếu hoặc thừa, một bên không xác nhận hoàn cọc, hai bên không thống nhất), **3 mới có test đơn vị** (đối soát khi chưa cập nhật, webhook gửi trùng, khôi phục tài khoản) vì cần khóa payOS hoặc chưa chạy qua giao diện.

## 5. Lỗi tìm thấy và đã sửa trong quá trình tích hợp

Các lỗi này lọt qua test đơn vị và chỉ lộ ra khi chạy thật:

- Giao dịch on-chain bị bỏ qua âm thầm vì nghiệp vụ và tầng Stellar truyền tham số không khớp.
- Chữ ký người dùng không bao giờ được gắn vào giao dịch (đọc sai danh sách chữ ký, thời hạn chữ ký đã hết, dựng lại giao dịch làm mất dữ liệu tài nguyên Soroban, không nhận ra loại thông tin xác thực mới của SDK).
- Mạng chỉ nhận một giao dịch chờ cho mỗi tài khoản nền tảng: giao dịch trả `TRY_AGAIN_LATER` bị coi là đã gửi nên kẹt hàng đợi. Đã khóa tuần tự và gửi lại có kiểm soát, giao dịch bị rơi tự được gửi mới.
- Nộp thừa tiền thuê không ghi nhận kỳ đã trả.
- Hạn thanh toán mới không được lưu vào database khi gia hạn.
- Hợp đồng mẫu chỉ có trong database nên mọi thao tác trên chain đều lỗi: nay kịch bản mẫu chạy qua chính API nghiệp vụ.
- Có thể giả danh bằng cách sửa cookie; người dùng thường tự nâng quyền thành quản trị; người dùng đăng nhập gọi trực tiếp hàm SQL quyết toán thanh toán. Đã vá, có test.
- Hộp thoại Passkey luôn báo thành công và mã bước hai thật chưa bao giờ được cấp; không có chỗ nào đăng ký được Passkey sau khi đăng nhập. Đã làm lại.
- Dữ liệu seed có hai giao dịch on-chain giả với mã băm bịa. Đã xóa.
- Nội dung giới thiệu ghi SEP-10 "đã triển khai" trong khi chưa làm. Đã sửa.

## 6. Chưa kiểm thử

- Hiệu năng online, tải, độ ổn định lâu dài.
- Lighthouse, thiết bị di động thật, Passkey trên điện thoại thật.
- payOS thật (chưa có khóa): tạo link, webhook ký thật, đối soát.
- Khôi phục tài khoản và nút "Kiểm tra lại" qua giao diện.
- Playwright E2E chính thức (mới có kịch bản API và một kịch bản trình duyệt cho Passkey).
- Hoàn cọc, giải quyết tranh chấp và `mark_overdue` đã chạy thật trên chain, nhưng chưa chạy chéo nhiều hợp đồng cùng lúc với tải lớn.

## 7. Số đo cuộn trang chủ

**Đính chính:** bản trước của mục này dùng script đo có cờ `--disable-frame-rate-limit=false`. Chrome chỉ kiểm tra sự tồn tại của cờ nên tốc độ khung hình bị mở khóa, dẫn đến con số khoảng 560 FPS vô lý và các số đếm layout hay khung giật không so sánh được giữa các lần chạy. Các số đó **bị rút lại**. Agent F đã bỏ cờ và đo lại với vsync chuẩn.

Đo bằng Chrome, giả lập CPU chậm 4 lần, trên bản build production, cùng một kịch bản cuộn:

| Trang | FPS | p95 khung (ms) | Khung giật trên 33 ms | Số lần layout |
|---|---|---|---|---|
| Trang chủ `/` (sau khi chuẩn hóa phép đo, trước tối ưu thêm) | 58,8 | 16,8 | 1 | 307 |
| Trang chủ `/` (sau tối ưu thêm) | 51,5 đến 59,3 (dao động giữa các lần) | 16,8 đến 33,4 | 1 đến 2 | 214 |
| `/minh-bach` | 60,0 | 16,7 | 0 | 0 |

Kết luận trung thực: ở phép đo đúng, trang chủ **đã gần 60 FPS** ngay cả khi CPU chậm 4 lần; các tối ưu bổ sung giảm số lần layout nhưng chưa cho thấy cải thiện FPS rõ rệt (dao động giữa các lần chạy lớn hơn mức cải thiện). Phản ánh "web lướt rất lag" ban đầu chưa được tái hiện bằng số đo; cảm nhận thực tế phụ thuộc máy, cần thử trên máy trình diễn thật.
