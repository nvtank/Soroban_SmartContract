# Đối chiếu yêu cầu Ideathon với sản phẩm

Cập nhật theo kết quả chạy thật trên máy local và Stellar Testnet. Ký hiệu: **Đạt** = đã chạy và kiểm chứng. **Một phần** = có mã nhưng chưa kiểm chứng đủ hoặc thiếu một vế. **Chưa** = chưa làm. **Mô phỏng** = cố ý mô phỏng, có nhãn trên giao diện.

Contract Testnet: `CCDNF4D4HRIDYSHBEOV2IYC2XQSTD7VPSFZ4NSGCT2QVDPJ7RX4UBVXU`.

## 1. Chức năng (mục 10.2 của đề)

| Yêu cầu | Trạng thái | Bằng chứng và ghi chú |
|---|---|---|
| Đăng ký, đăng nhập bằng SĐT và OTP | Đạt, OTP mô phỏng | Đăng nhập qua giao diện thật bằng OTP `123456`. Chưa có nhà cung cấp SMS, nhãn mô phỏng có trên màn hình. |
| Phân biệt Chủ nhà và Người thuê | Đạt | Quyền kiểm tra ở server. Người thuê vào trang admin bị 403, cookie giả bị 401. |
| Passkey / WebAuthn cho thao tác quan trọng | Một phần | Đăng ký và ký hợp đồng bằng Passkey chạy thật trên Chrome với thiết bị Passkey ảo, mã bước hai dùng một lần do server cấp. **Chưa thử trên điện thoại thật** (Face ID, vân tay). |
| Chủ nhà tạo hợp đồng, gửi người thuê xác nhận | Đạt | Form có xem trước mã băm. Người thuê xác nhận được. |
| Mã băm SHA-256 hợp đồng ghi lên Stellar Testnet | Đạt | `create_contract` ghi `doc_hash` có muối. Đã đọc ngược trạng thái từ chain và khớp database. |
| Hiển thị tiền cọc, trạng thái, hợp đồng liên quan | Đạt | Tab Tiền cọc và Tổng quan. |
| Mô phỏng nạp cọc bằng VietQR | Mô phỏng | Mã QR và nút "đã nhận tiền / thiếu / thừa / thất bại" đều có nhãn MÔ PHỎNG. |
| Sau thanh toán, backend cập nhật trạng thái và gửi giao dịch lên Soroban | Đạt | `record_deposit_paid`, `record_rent_paid` được xác nhận trên Testnet. |
| Hoàn cọc cần hai bên xác nhận | Đạt | Một bên duyệt thì chưa giải ngân. Hai bên cùng số tiền mới sang Đã hoàn trả. Lệch số tiền thì sang chờ xử lý tranh chấp. |
| Không đồng thuận thì chờ xử lý tranh chấp, hệ thống không tự kết luận | Đạt | Cọc bị khóa, chỉ chốt khi hai bên gửi cùng số tiền. |
| Tiền thuê: số phải trả, hạn, trạng thái | Đạt | 12 kỳ tự tạo khi hợp đồng hiệu lực. |
| Tạo QR mô phỏng thanh toán tiền thuê | Mô phỏng | Như trên. |
| Thông báo nhắc tiền thuê khi gần hạn hoặc quá hạn | Một phần | Có thông báo trong ứng dụng khi quá hạn. **Chưa có email hay push**, và chưa có nhắc trước hạn tự động. |
| Ghi nhận đã trả, còn thiếu, số ngày trễ | Đạt | Thiếu thì kỳ sang Thanh toán một phần. Phí trễ = tiền thuê × bps/ngày × số ngày / 10000, đã đối chiếu số liệu thật. |
| Chủ nhà gia hạn hoặc điều chỉnh phí trễ | Đạt | Mới làm: chỉ chủ nhà, đổi hạn, miễn phí trễ, ghi `extend_due` lên chain. **Điều chỉnh phí trễ theo số tiền tùy ý chưa có**, chỉ có gia hạn kèm miễn phí trễ. |
| Quá hạn thì cập nhật trạng thái và thông báo | Đạt | Quét quá hạn chạy tay (nút admin) hoặc bằng cron. Chưa gắn cron trên Vercel. |
| Ghi nhận khoản nợ điện, nước, phí dịch vụ | Một phần | Chủ nhà ghi nhận khoản nợ và đánh dấu đã nhận (chỉ trong database, không lên chain, không thanh toán qua VietQR). Có nhắc trước hạn. |
| Khấu trừ cọc có lý do và số tiền | Đạt | Lý do lưu ở database, on-chain chỉ có hash có muối. |
| Người thuê chấp nhận hoặc từ chối khấu trừ | Đạt | |

## 2. Trạng thái (mục 10.4)

Đạt. Bốn nhóm trạng thái khớp 1-1 giữa giao diện, backend, database và contract, có test chặn lệch (`states-sync`).

## 3. Bảy tình huống lỗi (mục 10.5)

| Tình huống | Trạng thái | Ghi chú |
|---|---|---|
| 1. Đã thanh toán nhưng chưa cập nhật | Một phần | Có trạng thái "Đang chờ xác nhận" và nút "Kiểm tra lại" (đối soát qua API payOS). **Chỉ có test đơn vị**, chưa chạy với payOS thật vì chưa có khóa. |
| 2. Thông báo xác nhận gửi nhiều lần | Một phần | Webhook idempotent bằng bảng `payment_events`, có test đơn vị. Chưa thử với webhook thật. |
| 3. Ghi Testnet thất bại | Đạt | Giao dịch ghi `FAILED` kèm lỗi, có nút thử lại, không làm hỏng nghiệp vụ. Đã quan sát khi chưa có contract và khi giao dịch bị rơi. Giao dịch bị rơi tự được gửi lại. |
| 4. Thanh toán thiếu hoặc thừa | Đạt | Chạy thật: thiếu thì chưa ghi nhận cọc, thừa thì vẫn ghi đủ và lưu phần thừa, không tự hoàn. |
| 5. Một bên không xác nhận hoàn cọc | Đạt | Giữ Chờ hoàn cọc, không giải ngân. Có thông báo nhắc bên kia. |
| 6. Hai bên không thống nhất khấu trừ | Đạt | Chuyển Chờ xử lý tranh chấp, khóa cọc. |
| 7. Mất quyền truy cập, khôi phục tài khoản | Một phần | Có API và màn hình mô phỏng (OTP, eKYC giả, admin duyệt, thu hồi Passkey cũ). Đã chạy qua giao diện thật bằng Playwright: nhập số, OTP, eKYC giả, yêu cầu chờ quản trị duyệt, quản trị duyệt, người dùng bấm kiểm tra lại. **Chưa cấp Passkey mới trên thiết bị thật** (cần thiết bị Passkey). |

## 4. Đầu ra Demo (mục 10.6)

| Yêu cầu | Trạng thái |
|---|---|
| Đăng nhập và dùng theo vai trò | Đạt |
| Tạo hợp đồng, gửi người thuê | Đạt |
| Mã băm hợp đồng trên Testnet | Đạt |
| Thanh toán mô phỏng bằng VietQR | Đạt (mô phỏng) |
| Hiển thị thanh toán, cọc, công nợ | Đạt |
| Hoàn cọc hoặc khấu trừ | Đạt |
| Giao dịch và trạng thái ghi trên Soroban | Đạt: 12 hàm thay đổi trạng thái đều đã xác nhận trên Testnet |
| **Demo Online truy cập được** | **Chưa**, chưa deploy Vercel (hạn 06/12) |
| Có dữ liệu mẫu | Đạt: `POST /api/demo/prepare` hoặc nút ở trang admin demo |

## 5. Bốn tiêu chí chấm

**1. Nguyên lý Blockchain và hệ sinh thái Stellar (20%)**
- Soroban: Đạt (xem trên).
- CAP-15 Fee-Bump: Đạt trên Testnet. Giao dịch được bọc `FeeBumpTransaction`, tài khoản nền tảng trả phí. Lưu ý trung thực: giao dịch bên trong cũng do tài khoản nền tảng làm nguồn, người dùng chỉ ký phần ủy quyền Soroban.
- SEP-10: **Chưa làm**, ghi lộ trình. Dự án dùng OTP và Passkey, không dùng SEP-10.
- Stellar Anchor: **Chưa làm**, ghi lộ trình.
- Phần giải thích nguyên lý Blockchain và lý do chọn Stellar là nội dung thuyết trình và báo cáo, không phải mã.

**2. Ứng dụng Stellar trong nghiệp vụ tài chính (20%)**
- Quy trình ghi nhận hợp đồng, xác nhận thanh toán, quyết toán: Đạt, chứng minh bằng giao dịch thật.
- Kết nối Blockchain, Backend và ngân hàng: Blockchain và Backend **thật**. Ngân hàng **mô phỏng hoàn toàn**: không có kết nối ngân hàng, payOS chỉ là cổng tạo mã QR, không phải tài khoản escrow.

**3. Đạo đức Blockchain và AI (40%)**
- Không đưa dữ liệu cá nhân lên chain: Đạt. Script quét 6 giao dịch thật cho kết quả sạch. On-chain chỉ có UUID hợp đồng, địa chỉ ví, hash có muối, số tiền, trạng thái.
- Bảo mật bí mật: Đạt. Quét toàn bộ repo và lịch sử git, không lộ khóa.
- Phân quyền: Đạt, kiểm tra ở server và RLS. Đã tìm và vá nhiều lỗi leo thang quyền trong quá trình làm.
- Không dùng AI trong luồng nghiệp vụ: Đạt, trang Minh bạch ghi rõ.
- Không đưa số liệu chưa xác thực: **Một phần**. Hai con số 9.570 và 15.549 hiển thị kèm nhãn "Chưa xác minh nguồn". **Cần bạn tìm bài báo hoặc văn bản gốc** trước ngày thi.
- Rủi ro cần nói thẳng khi trình bày: ví do server giữ hộ, khóa chủ nằm trong biến môi trường (bản thật cần HSM hoặc KMS). Ở `DEMO_MODE=true`, API vẫn nhận mã bỏ qua bước hai `demo-step-up` cho kịch bản kiểm thử tự động, **phải tắt khi chạy thật**.

**4. Demo sản phẩm (20%)**
- Chạy ổn định: Đạt trên local. Online: Chưa.
- Giao dịch thật với Testnet: Đạt.
- Luồng từ thao tác người dùng đến backend và contract: Đạt.
- Phương án dự phòng: Một phần. Có chế độ thanh toán mô phỏng và dữ liệu có sẵn bằng chứng on-chain. Đã có kịch bản quay tự động `pnpm e2e:video` (khoảng 50 giây, tệp webm không đưa lên git); **cần quay lại trên máy trình diễn trước buổi thi** vì dữ liệu và giao diện còn đổi.

## 6. Những điểm trong tài liệu bạn dán cần sửa lại cho khớp sản phẩm

Đây là các câu nếu giữ nguyên trong báo cáo hoặc slide sẽ trái quy tắc trung thực của cuộc thi:

1. "Tiền cọc phong tỏa 100% tại Ngân hàng", "Webhook ngân hàng cập nhật Smart Contract", "Tuân thủ 100% pháp lý VN": demo **không có kết nối ngân hàng**. Trình bày là thiết kế mục tiêu và cần thỏa thuận ngân hàng, không phải tính năng đã làm. Muốn chứng minh "ngân hàng chịu trách nhiệm giữ tiền" thì phải dẫn căn cứ pháp lý và hợp đồng ngân hàng, demo không chứng minh được điều đó.
2. "Smart Contract tự động trích tiền từ cọc": contract **không giữ tiền VNĐ**. Nó ép luật hai bên cùng xác nhận rồi phát sự kiện cho phép giải ngân. Việc chuyển tiền là mô phỏng.
3. "Mã hóa ảnh chụp bàn giao lên sổ cái": mới băm **nội dung hợp đồng**. Chưa có tải ảnh bàn giao hay băm ảnh.
4. "Tiền chảy thẳng sang chủ nhà", "Ngân hàng giải ngân tự động": mô phỏng.
5. Doanh thu 15.000 đ/hợp đồng, so sánh phí iTro, QuanLyTro, ngưỡng "sẵn lòng trả": chưa có nguồn kiểm chứng, đừng đưa lên giao diện, trong báo cáo cần dẫn nguồn.

## 7. Phần dàn ý báo cáo (không phải mã nguồn)

Sản phẩm cung cấp tài liệu thô cho: 3.2 kiến trúc (`docs/CONTRACTS.md`, bảng On-chain/Off-chain ở `/minh-bach`), 3.3 Smart Contract (`docs/ABI.md`), 4.1 và 4.2 (README, ảnh chụp màn hình), 4.3 kiểm thử (`docs/TEST_REPORT.md`), 4.4 hạn chế (mục 1 đến 3 của file này). Các chương 1, 2, 5 (thị trường, đối thủ, mô hình kinh doanh, SWOT, lộ trình) là việc của nhóm viết và tìm nguồn.

## 8. Việc còn lại theo thứ tự ưu tiên

1. Deploy Demo Online (Vercel, Supabase cloud) trước 06/12.
2. Thử Passkey trên điện thoại thật.
3. Quay lại video dự phòng trên máy trình diễn.
4. Nút "Kiểm tra lại" khi mạng chập chờn.
5. Tìm nguồn cho hai con số PCCC.
6. Đo hiệu năng bằng Lighthouse.
