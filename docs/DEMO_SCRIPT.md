# Kịch bản trình diễn RentFlow (4 đến 5 phút)

Mọi tiền, ngân hàng, mã QR và OTP trong bản demo đều là **mô phỏng**. Blockchain là **Stellar Testnet thật**, không có giá trị tiền thật. Hãy nói điều này ngay từ đầu, đúng với banner đang hiện trên mọi trang.

## Chuẩn bị (làm trước giờ trình diễn)

1. Bật Supabase local: `pnpm dlx supabase start`.
2. Chạy app: `pnpm dev -p 3112 -H 127.0.0.1`, mở **http://localhost:3112** (dùng `localhost`, không dùng `127.0.0.1`, để Passkey hoạt động).
3. Chuẩn bị dữ liệu: đăng nhập chủ nhà rồi vào **Admin demo** bấm "Chuẩn bị kịch bản demo", hoặc `curl -X POST -H "origin: http://localhost:3112" http://localhost:3112/api/demo/prepare`.
4. Chờ khoảng 1 phút để các giao dịch ghi lên Testnet. Kiểm tra ở trang `/bang-chung`: phải có danh sách giao dịch với liên kết explorer.
5. Mở hai cửa sổ ẩn danh: một cho **Chủ nhà**, một cho **Người thuê**.

| Vai | Số điện thoại | OTP (mô phỏng) |
|---|---|---|
| Chủ nhà | 0900000001 | 123456 |
| Người thuê 1 | 0900000002 | 123456 |
| Người thuê 2 | 0900000003 | 123456 |

Dữ liệu có sẵn sau bước chuẩn bị:

| Hợp đồng | Trạng thái | Dùng để diễn |
|---|---|---|
| Phòng 301 - Tòa Sunrise | Chờ người thuê xác nhận | Bước 1 và 2 |
| Phòng 402 - Căn hộ Moonlight | Đang hiệu lực, kỳ 1 quá hạn có phí trễ | Bước 3 và gia hạn |
| Phòng 102 - Nhà phố Green | Cọc đang khóa chờ xử lý tranh chấp (người thuê 2) | Bước 5 |

## Luồng trình diễn

**0:00 Mở đầu (30 giây)** Trang chủ. Nói ba nỗi đau và cách mỗi nỗi đau được giải quyết. Chỉ banner mô phỏng. Mở `/minh-bach` một lúc: bảng dữ liệu nào ở Off-chain, nào ở On-chain.

**0:30 Bước 1: ký hợp đồng (45 giây)**
- Chủ nhà đăng nhập, xem 3 hợp đồng, mở Phòng 301. Có thể tạo nhanh một hợp đồng mới để cho thấy mã băm hiện ngay khi nhập.
- Người thuê 1 đăng nhập, bấm xác nhận hợp đồng Phòng 301, ký bằng **Passkey** (hoặc OTP mô phỏng nếu máy không có Passkey). Hợp đồng chuyển sang Đang hiệu lực.

**1:15 Bước 2: nạp cọc (45 giây)** Người thuê nạp cọc, hiện mã VietQR **mô phỏng**, bấm "Giả lập: đã nhận tiền". Cọc chuyển sang Đã ghi nhận. Mở ngăn **Bằng chứng on-chain**, chỉ giao dịch `record_deposit_paid`, bấm liên kết sang explorer để cho ban giám khảo thấy giao dịch thật.

**2:00 Bước 3: tiền thuê và phí trễ (45 giây)** Mở Phòng 402, tab Tiền thuê: kỳ 1 quá hạn, có số ngày trễ và phí trễ tính theo công thức đã cam kết. Chủ nhà bấm **Gia hạn thanh toán**, chọn hạn mới: phí trễ được miễn, giao dịch `extend_due` được ghi lên chain.

**2:45 Bước 4: hoàn cọc (45 giây)** Tab Hoàn cọc. Người thuê duyệt hoàn đủ, hệ thống **chưa** giải ngân. Chủ nhà duyệt cùng số tiền, cọc chuyển sang Đã hoàn trả. Nhấn mạnh: một bên không thể tự rút.

**3:30 Bước 5: tranh chấp (45 giây)** Mở Phòng 102 (người thuê 2). Cọc đang ở trạng thái Chờ xử lý tranh chấp. Nói rõ: hệ thống không tự kết luận ai đúng, chỉ chốt khi hai bên cùng gửi một số tiền.

**4:15 Kết (30 giây)** Trang `/bang-chung`: các giao dịch Testnet thật, không có dữ liệu cá nhân. Nhắc ba điều: dữ liệu cá nhân không lên chain, không dùng AI quyết định nghiệp vụ, những gì là mô phỏng.

## Điểm nhấn theo bốn tiêu chí

| Tiêu chí | Nói và chỉ vào |
|---|---|
| Blockchain và Stellar (20%) | Soroban làm máy trạng thái và kiểm chữ ký từng bên. Phí do nền tảng trả bằng Fee-Bump (CAP-15), người dùng không chạm XLM. Nói thẳng SEP-10 và Anchor là lộ trình. |
| Ứng dụng nghiệp vụ (20%) | Mỗi hành động trên giao diện sinh một giao dịch thật, xem được trên explorer. Nói rõ ngân hàng là mô phỏng. |
| Đạo đức (40%) | Bảng On-chain/Off-chain, giao dịch không có dữ liệu cá nhân, hash có muối, số liệu chưa xác minh có nhãn, không dùng AI, nói trước rủi ro của ví do server giữ hộ. |
| Demo (20%) | Thao tác trực tiếp từ giao diện đến giao dịch trên Testnet. |

## Phương án dự phòng

| Sự cố | Cách xử lý |
|---|---|
| Mạng Testnet chậm hoặc lỗi | Giao dịch hiện trạng thái Thất bại hoặc Đang ghi, nghiệp vụ vẫn chạy bình thường. Nói đây chính là cơ chế hàng đợi và thử lại. Mở sẵn trang explorer của contract và vài giao dịch đã xác nhận: `https://stellar.expert/explorer/testnet/contract/CCDNF4D4HRIDYSHBEOV2IYC2XQSTD7VPSFZ4NSGCT2QVDPJ7RX4UBVXU`. |
| Passkey không hoạt động trên máy trình diễn | Chọn tab OTP (mô phỏng) trong hộp thoại ký, mã `123456`. |
| Dữ liệu bị rối | Admin demo bấm "Đặt lại về kịch bản demo ban đầu", chờ khoảng 1 phút. |
| Web lỗi hoàn toàn | Phát video quay sẵn (**chưa quay, cần làm**) và mở explorer cho giao dịch thật. |
| Online không truy cập được | Chạy bản local như trên. |

## Việc cần làm trước ngày thi

- Quay video dự phòng.
- Thử Passkey trên thiết bị trình diễn thật.
- Sau khi deploy online: đặt `WEBAUTHN_RP_ID` và `WEBAUTHN_ORIGIN` đúng tên miền, tắt `DEMO_MODE` bỏ qua bước hai nếu không phải là buổi trình diễn.
