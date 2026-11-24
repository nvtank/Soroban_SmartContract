# Báo cáo kiểm thử

Chỉ ghi những gì đã thật sự chạy. Mọi số liệu lấy từ lần chạy cuối trên máy local, Supabase local, Stellar Testnet. Chưa có số đo hiệu năng cho môi trường online.

## 1. Kiểm thử tự động

| Bộ kiểm thử | Kết quả | Lệnh |
|---|---|---|
| Unit và tích hợp (Vitest) | 50 tệp, **382/382 đạt** | `pnpm test` |
| E2E trên trình duyệt thật (Playwright) | 7 tệp, **24/24 đạt**, 1 bỏ qua (kịch bản video) | `pnpm e2e` |
| Video dự phòng kịch bản demo | 5 bước, **12.58 MB (50.16s)** tại `demo-assets/demo-backup.webm` | `pnpm e2e:video` |
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

## 3. Giao diện trình duyệt thật (Playwright Chrome E2E)

Bộ kiểm thử E2E tự động trên trình duyệt thật (Playwright nối trực tiếp app local và Stellar Testnet) đạt **24/24 bài test** trên 6 bộ kịch bản nghiệp vụ (thời gian chạy ~1.7 phút):

1. **Luồng trình diễn chính 7 bước (`tests/e2e/demo-flow.spec.ts` - 7/7 đạt):**
   - Khởi tạo kịch bản demo qua `POST /api/demo/prepare` và chờ tối thiểu 10 giao dịch xác nhận trên Testnet.
   - Bước 1: Người thuê ký xác nhận hợp đồng Phòng 301, chuyển trạng thái sang Đang hiệu lực.
   - Bước 2: Người thuê nạp cọc bằng VietQR mô phỏng (bấm "Giả lập: Đã nhận đủ tiền"), cọc chuyển sang Đã ghi nhận.
   - Bước 3: Chủ nhà xem kỳ quá hạn Phòng 402, thực hiện gia hạn thanh toán, phí phạt trễ được miễn.
   - Bước 4: Hoàn cọc hai bên cùng ký duyệt (người thuê xác nhận, cọc chưa giải ngân; chủ nhà duyệt tiếp cùng số tiền, cọc mới chuyển Đã hoàn trả).
   - Bước 5: Kiểm tra tính trung lập trong tranh chấp tại Phòng 102, hệ thống không tự trừ tiền hay kết luận bên nào đúng.
   - Bằng chứng on-chain: Bảng giao dịch hiển thị link Stellar Expert thật và **không lọt bất kỳ PII nào** (không số điện thoại, không họ tên).
2. **Nộp thiếu rồi nộp đủ (`tests/e2e/payment-partial.spec.ts` - 1/1 đạt):**
   - Hộp thoại VietQR mô phỏng hiển thị chính xác nhãn nộp thiếu (`UNDERPAID`), sau đó chuyển trạng thái thành công (`CONFIRMED`) khi nộp đủ.
3. **Phân quyền vai trò trên giao diện (`tests/e2e/role-permissions.spec.ts` - 2/2 đạt):**
   - Chủ nhà thấy nút tạo hợp đồng, form đề xuất khấu trừ, nhưng không thấy nút "Nộp tiền" của người thuê.
   - Người thuê thấy nút nộp tiền, nhưng không thấy nút tạo hợp đồng, gia hạn hay form đề xuất khấu trừ của chủ nhà.
4. **Banner mô phỏng và loại bỏ thuật ngữ Web3 (`tests/e2e/web3-jargon-and-banner.spec.ts` - 7/7 đạt):**
   - Banner mô phỏng hiển thị trên mọi trang (`/`, `/dang-nhap`, `/app`, `/bang-chung`, `/minh-bach`).
   - Toàn bộ giao diện `/app/**` không chứa các từ khóa Web3 (`XLM`, `gas`, `seed phrase`) ngoài ngăn Bằng chứng on-chain.
5. **Giao diện di động 390x844 (`tests/e2e/mobile-viewport.spec.ts` - 5/5 đạt):**
   - Kiểm tra các màn hình chính không tràn ngang, nút bấm chính thao tác tốt. Phát hiện hiện tượng tràn ngang do thanh cuộn tab ở `/app/hop-dong/[id]` (đã lưu ảnh `test-results/mobile-overflow-contract-detail.png`).
6. **Khôi phục tài khoản (`tests/e2e/recovery.spec.ts` - 2/2 đạt):**
   - Khách vãng lai truy cập `/app/khoi-phuc` bị route guard chuyển hướng về `/dang-nhap`.
   - Người dùng đăng nhập thực hiện trọn vẹn 4 bước khôi phục (nhập SĐT -> OTP -> eKYC mô phỏng -> Admin cấp lại Passkey mô phỏng).
7. **Video kịch bản demo (`tests/e2e/demo-video.spec.ts` - `pnpm e2e:video`):**
   - Chạy tự động toàn bộ 5 bước theo `docs/DEMO_SCRIPT.md` với `slowMo: 400`, tự động xuất video `demo-assets/demo-backup.webm` (12.58 MB, thời lượng 50.16s).

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
- Thiết bị di động thật và Passkey trên điện thoại thật (mới kiểm thử trên Chromium viewport 390x844 và Passkey ảo Chrome).
- payOS thật (chưa có khóa): tạo link, webhook ký thật, đối soát.
- Nút "Kiểm tra lại" qua giao diện ở các tình huống mạng chập chờn.
- Thử tải đã làm ở mức nhỏ: 5 hợp đồng song song, 15 giao dịch, 15 xác nhận, 0 lỗi (`scripts/chain-stress.mjs`, Agent D). Chưa thử mức lớn hơn. Hoàn cọc, giải quyết tranh chấp và `mark_overdue` đã chạy thật trên chain, nhưng chưa chạy chéo với tải lớn.

## 7. Số đo cuộn trang chủ

**Đính chính:** bản trước của mục này dùng script đo có cờ `--disable-frame-rate-limit=false`. Chrome chỉ kiểm tra sự tồn tại của cờ nên tốc độ khung hình bị mở khóa, dẫn đến con số khoảng 560 FPS vô lý và các số đếm layout hay khung giật không so sánh được giữa các lần chạy. Các số đó **bị rút lại**. Agent F đã bỏ cờ và đo lại với vsync chuẩn.

Đo bằng Chrome, giả lập CPU chậm 4 lần, trên bản build production, cùng một kịch bản cuộn:

| Trang | FPS | p95 khung (ms) | Khung giật trên 33 ms | Số lần layout |
|---|---|---|---|---|
| Trang chủ `/` (sau khi chuẩn hóa phép đo, trước tối ưu thêm) | 58,8 | 16,8 | 1 | 307 |
| Trang chủ `/` (sau tối ưu thêm) | 51,5 đến 59,3 (dao động giữa các lần) | 16,8 đến 33,4 | 1 đến 2 | 214 |
| `/minh-bach` | 60,0 | 16,7 | 0 | 0 |

Kết luận trung thực: ở phép đo đúng, trang chủ **đã gần 60 FPS** ngay cả khi CPU chậm 4 lần; các tối ưu bổ sung giảm số lần layout nhưng chưa cho thấy cải thiện FPS rõ rệt (dao động giữa các lần chạy lớn hơn mức cải thiện). Phản ánh "web lướt rất lag" ban đầu chưa được tái hiện bằng số đo; cảm nhận thực tế phụ thuộc máy, cần thử trên máy trình diễn thật.
