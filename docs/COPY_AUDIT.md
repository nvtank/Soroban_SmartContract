# Báo cáo Kiểm toán Nội dung (Copy Audit) — Dự án RentFlow

> **Phiên bản:** Vòng 4 (Hoàn thiện độ mượt & Kiểm toán nội dung trung thực)  
> **Người thực hiện:** Agent F (Landing UI & Content Auditor)  
> **Cam kết cốt lõi:** Trung thực tuyệt đối (Tiêu chuẩn Đạo đức chiếm 40% điểm thi Ideathon). Không bịa kết quả, không nói quá năng lực công nghệ, công khai rõ ràng ranh giới giữa tính năng chạy thật và tính năng mô phỏng.

---

## 1. Sự thật hiện tại của sản phẩm RentFlow (Ground Truth)

Trước khi đối chiếu từng câu chữ, đây là bảng đối soát thực tế được xác nhận từ mã nguồn, cơ sở dữ liệu Supabase local và smart contract trên Stellar Testnet (`CCDNF4D4HRIDYSHBEOV2IYC2XQSTD7VPSFZ4NSGCT2QVDPJ7RX4UBVXU`):

| Thành phần | Trạng thái kỹ thuật thực tế | Bằng chứng mã nguồn / Kiểm thử |
|---|---|---|
| **Ngân hàng thương mại** | **MÔ PHỎNG** (Chưa có kết nối tài khoản phong tỏa escrow thật) | `src/domain/payments/service.ts`, `src/lib/payos/client.ts` |
| **Cổng VietQR / payOS** | **MÔ PHỎNG / TEST MODE** (payOS chưa kiểm chứng với tài khoản doanh nghiệp thực tế; dùng QR tự sinh và webhook giả lập) | `src/app/api/payments/payos/webhook/route.ts`, `src/components/app/mock/mock-service.ts` |
| **Xác thực OTP** | **MÔ PHỎNG** (Mã cố định `123456`, chưa có nhà cung cấp SMS thương mại) | `src/app/api/auth/otp/verify/route.ts` |
| **Giải ngân dòng tiền** | **MÔ PHỎNG** (Contract chỉ phát sự kiện `release_authorized`, backend cập nhật UI, không có lệnh chuyển khoản liên ngân hàng thật) | `contracts/rentflow/src/contract.rs` |
| **Soroban Smart Contract** | **CHẠY THẬT TRÊN TESTNET** nhưng **KHÔNG GIỮ TIỀN VNĐ** (Chỉ giữ máy trạng thái, kiểm tra điều kiện hai bên đồng thuận và lưu mã băm) | `contracts/rentflow/src/lib.rs`, `docs/CONTRACTS.md` |
| **Xác thực Passkey (WebAuthn)** | **CHẠY THẬT VỚI THIẾT BỊ ẢO** (Đã thử nghiệm thành công trên Chrome bằng Virtual Authenticator qua `@simplewebauthn`; **chưa thử trên điện thoại thật** với Face ID / vân tay) | `src/lib/crypto/passkey.ts`, `tests/e2e/demo-flow.spec.ts` |
| **CAP-15 Fee-Bump** | **CHẠY THẬT TRÊN TESTNET** (Tài khoản nền tảng bọc `FeeBumpTransaction` và trả phí gas thay người dùng) | `src/lib/stellar/client.ts`, `src/lib/stellar/submit.ts` |
| **SEP-10 & Stellar Anchor** | **CHƯA LÀM (LỘ TRÌNH DÀI HẠN)** (Dự án dùng OTP và Passkey, chưa tích hợp SEP-10 đăng nhập ví; chưa tích hợp Anchor SEP-24 nạp/rút VND) | `docs/REQUIREMENTS_CHECK.md` (mục 5.1) |
| **Mã băm bằng chứng (Hashing)** | **CHẠY THẬT** nhưng **MỚI BĂM NỘI DUNG HỢP ĐỒNG, CHƯA CÓ ẢNH BÀN GIAO** (`doc_hash`, `reason_hash`, `payment_ref_hash` có salt 32-byte; chưa có upload hay băm ảnh bàn giao phòng) | `src/lib/stellar/hash.ts`, `docs/CONTRACTS.md` |
| **Trí tuệ nhân tạo (AI)** | **TUYỆT ĐỐI KHÔNG DÙNG AI TRONG LUỒNG NGHIỆP VỤ** (Không chấm điểm người thuê, không phán quyết tranh chấp, không quyết định giải ngân) | `src/app/(marketing)/minh-bach/page.tsx` |
| **Số liệu thị trường** | **CHƯA XÁC MINH NGUỒN** (2 con số 9.570 phòng và 15.549 người thuê lấy từ brief Ideathon, chưa có văn bản báo chí gốc đối chứng) | `src/content/facts.ts` |

---

## 2. Bảng kiểm toán chi tiết từng câu khẳng định (Copy Audit Table)

Dưới đây là kết quả kiểm toán toàn bộ câu chữ trên Trang chủ (`/`), Trang Minh bạch (`/minh-bach`) và Chân trang (`Footer`):

### 2.1. Hero Section & Banner Demo

| STT | Vị trí | Câu nguyên văn ban đầu | Đánh giá tính đúng đắn | Bằng chứng & Hành động sửa đổi |
|---|---|---|---|---|
| 1 | DemoBanner | *"Bản demo: ngân hàng và giải ngân là mô phỏng. Blockchain chạy trên Stellar Testnet, không có giá trị tiền thật."* | **ĐÚNG** | Giữ nguyên. Banner dính cố định đỉnh màn hình ở mọi chế độ viewport. |
| 2 | Hero Tagline | *"Bảo chứng tiền cọc & Thu tiền thuê nhà"* | **CHƯA RÕ RÀNG** (có thể gây hiểu nhầm là tiền cọc thật) | Sửa thành: *"Bảo chứng tiền cọc (mô phỏng) & Thu tiền thuê nhà"*. |
| 3 | Hero Description | *"RentFlow là dịch vụ bảo chứng tiền cọc trung lập và tự động hóa thu tiền thuê nhà qua VietQR. Khóa cọc an toàn, chỉ giải ngân khi cả hai bên xác nhận; lưu bằng chứng bất biến trên Stellar Testnet mà không lộ bất kỳ dữ liệu cá nhân nào."* | **NÓI QUÁ** (VietQR, giải ngân là mô phỏng, contract không giữ VNĐ) | Sửa thành: *"RentFlow là mô hình bảo chứng tiền cọc trung lập và tự động hóa theo dõi thu tiền thuê nhà qua VietQR (mô phỏng). Trạng thái cọc được kiểm soát bởi smart contract Soroban, chỉ cho phép phát sự kiện giải ngân khi cả hai bên cùng xác nhận; lưu bằng chứng băm SHA-256 bất biến trên Stellar Testnet mà không lưu bất kỳ dữ liệu cá nhân nào."* |
| 4 | Hero Trust Note | *"Bản demo: ngân hàng và giải ngân là mô phỏng. Bằng chứng chạy trên Stellar Testnet."* | **THIẾU** (cần nêu cả VietQR và OTP) | Sửa thành: *"Bản demo: ngân hàng, VietQR, OTP và giải ngân là mô phỏng. Bằng chứng chạy trên Stellar Testnet."* |

---

### 2.2. Chương 01: Vấn đề (Problem Section) & Số liệu (Facts)

| STT | Vị trí | Khẳng định nguyên văn | Đánh giá tính đúng đắn | Bằng chứng & Hành động sửa đổi |
|---|---|---|---|---|
| 5 | Card 03 | *"Ảnh bàn giao phòng, tin nhắn thỏa thuận thất lạc qua Zalo, Messenger..."* | **CẦN CHÍNH XÁC** (Sản phẩm chưa có ảnh bàn giao) | Sửa thành: *"Thỏa thuận, tin nhắn trao đổi thất lạc qua Zalo, Messenger. Khi xảy ra xích mích không có biên bản thống nhất bất biến để đối chiếu."* |
| 6 | Fact 01 | *9.570 phòng trọ bị đình chỉ trong đợt kiểm tra PCCC đầu tháng 4/2025* | **CHƯA KIỂM CHỨNG NGUỒN** | Gắn nhãn bắt buộc `"Chưa xác minh nguồn"`, ghi chú rõ *"Nêu trong brief Ideathon, chưa đối chiếu với văn bản hoặc bài báo gốc"*. |
| 7 | Fact 02 | *15.549 người thuê bị ảnh hưởng trong cùng đợt kiểm tra* | **CHƯA KIỂM CHỨNG NGUỒN** | Gắn nhãn bắt buộc `"Chưa xác minh nguồn"`, ghi chú rõ *"Nêu trong brief Ideathon, chưa đối chiếu với văn bản hoặc bài báo gốc"*. |

---

### 2.3. Chương 02: Giải pháp (Solution Section — Đối chiếu 1-1 với Vấn đề)

| STT | Cặp đối chiếu | Vấn đề (Nỗi đau thực tế) | Giải pháp RentFlow & Công khai Thực tế vs Mô phỏng |
|---|---|---|---|
| 8 | Cặp 01 | **Giam cọc / Trừ cọc vô lý:** Tiền cọc nằm hoàn toàn trong tay chủ nhà, người thuê ở thế bị động. | **Két cọc hai chìa khóa (Dual-Key Vault):** Hợp đồng Soroban chạy thật trên Testnet kiểm soát trạng thái, chỉ phát sự kiện giải ngân khi CẢ HAI BÊN cùng gửi đúng số tiền bằng chữ ký Passkey. **Công khai:** Phần giải ngân và giữ tiền VNĐ hiện là **MÔ PHỎNG** (contract không giữ tiền VNĐ, chưa kết nối tài khoản phong tỏa ngân hàng). |
| 9 | Cặp 02 | **Trễ tiền & Mất công đòi nợ:** Không có chuẩn hóa lịch thu, nhắc nợ thủ công, cãi vã về số ngày quá hạn và tiền phạt. | **VietQR động & Quy tắc phạt trễ tự động:** Hệ thống tự động tính ngày quá hạn và tiền phạt trễ hạn chính xác theo công thức cam kết (%/ngày), ghi nhận kỳ thuê lên Testnet (**CHẠY THẬT**). **Công khai:** Phần phát sinh mã VietQR và đối soát thanh toán hiện ở chế độ **MÔ PHỎNG** (chưa kết nối cổng thanh toán thật, payOS chưa kiểm chứng). |
| 10 | Cặp 03 | **Bằng chứng rải rác, khó phân xử:** Hợp đồng giấy dễ sửa đổi, thỏa thuận thất lạc, không có nguồn sự thật khách quan bất biến. | **Bằng chứng SHA-256 trên Stellar Testnet:** Văn bản hợp đồng được chuẩn hóa và băm SHA-256 kèm muối ngẫu nhiên (salt 32-byte), lưu bất biến lên Soroban Testnet (**CHẠY THẬT**). **Công khai:** Hệ thống mới băm nội dung hợp đồng, **CHƯA** có tính năng lưu hay băm ảnh hiện trạng bàn giao (đây là định hướng lộ trình). |

---

### 2.4. Chương 03: Quy trình 5 bước (How It Works)

| STT | Bước | Câu nguyên văn ban đầu | Đánh giá | Sửa đổi đảm bảo tính trung thực |
|---|---|---|---|---|
| 11 | Bước 01 (SIGN) | *"Người thuê xác thực danh tính và ký điện tử qua Passkey/WebAuthn."* | **THIẾU GHI CHÚ THỬ NGHIỆM** | Bổ sung: *"ký điện tử qua Passkey/WebAuthn (thử nghiệm với thiết bị ảo trên Chrome). Ví custody được cấp và ký giao dịch trên Stellar Testnet."* |
| 12 | Bước 02 (DEPOSIT) | *"Người thuê quét mã VietQR tự sinh. Sau khi cổng thanh toán xác nhận đúng số tiền... cọc vào két bảo chứng"* | **NÓI QUÁ** (VietQR và cọc là mô phỏng) | Sửa thành: *"Người thuê quét mã VietQR (mô phỏng). Sau khi cổng thanh toán mô phỏng xác nhận đúng số tiền, backend đưa giao dịch vào hàng đợi Outbox. Soroban chuyển trạng thái tiền cọc sang RECORDED. Contract không giữ tiền VNĐ."* |
| 13 | Bước 03 (RENT) | *"Đến hạn hàng tháng, VietQR kỳ thuê được phát hành tự động..."* | **CẦN LÀM RÕ** | Bổ sung: *"mã VietQR kỳ thuê được phát hành (mô phỏng)... tự tính phí phạt chính xác theo công thức quy định (rent × bps × days / 10000) và cập nhật công nợ lên Testnet."* |
| 14 | Bước 04 (SETTLE) | *"Chỉ khi cả hai bên dùng Passkey đồng thuận cùng một số tiền, két mới mở giải ngân."* | **NÓI QUÁ** (giải ngân thật) | Sửa thành: *"smart contract mới phát sự kiện giải ngân (mô phỏng, không có chuyển khoản ngân hàng thật)."* |
| 15 | Bước 05 (DISPUTE) | *"Nếu người thuê từ chối mức khấu trừ... Tiền cọc bị khóa cứng..."* | **ĐÚNG** | Giữ nguyên và làm rõ: *"Tiền cọc bị khóa cứng trên contract, RentFlow tuyệt đối không tự phán quyết bên nào đúng."* |

---

### 2.5. Chương 04: Kiến trúc công nghệ & Thẻ kỹ thuật

| STT | Thẻ công nghệ | Nội dung khẳng định | Trạng thái công bố | Ghi chú trung thực |
|---|---|---|---|---|
| 16 | Stellar & Soroban | Smart contract quản lý máy trạng thái, kiểm tra chữ ký xác nhận. | **ĐÃ TRIỂN KHAI TRÊN TESTNET** | Contract KHÔNG giữ tiền VNĐ. |
| 17 | Passkey (WebAuthn) | Ký xác nhận không cần mật khẩu. | **ĐÃ CHẠY THỬ (THIẾT BỊ ẢO)** | Đã chạy trên Chrome với Virtual Authenticator; chưa thử trên thiết bị di động thật (Face ID/vân tay). |
| 18 | CAP-15 Fee-Bump | Nền tảng trả phí gas thay người dùng. | **ĐÃ CHẠY TRÊN TESTNET** | Người dùng không cần sở hữu XLM để giao dịch trên Testnet. |
| 19 | SEP-10 & Anchor | Xác thực ví chuẩn Stellar và cầu nối nạp rút VND. | **LỘ TRÌNH DÀI HẠN (CHƯA LÀM)** | Ghi rõ chưa triển khai trong bản demo. Dự án hiện dùng OTP và Passkey. |
| 20 | Game phân loại dữ liệu | Thẻ "Ảnh hiện trạng bàn giao phòng" | **SỬA LẠI** | Đổi thành: *"Biên bản bàn giao phòng (Lộ trình: kèm ảnh)"*, ghi chú rõ *"Văn bản hiện trạng off-chain (hiện chưa hỗ trợ tải ảnh bàn giao)"*. |

---

### 2.6. Chương 05 & Footer

| STT | Vị trí | Khẳng định ban đầu | Đánh giá & Sửa đổi |
|---|---|---|---|
| 21 | Bảng So sánh | Hàng Bằng chứng khi tranh chấp | Nêu rõ: *"Hash SHA-256 có muối lưu trên Stellar Testnet, bất biến, khóa cọc khi bất đồng. (Lưu ý: mới băm nội dung hợp đồng, chưa có ảnh bàn giao)."* |
| 22 | Bảng So sánh | Hàng Trải nghiệm người dùng | Ghi rõ: *"Giao diện tiếng Việt, quét VietQR (mô phỏng), Passkey (thử nghiệm trên thiết bị ảo), không chạm XLM hay gas nhờ CAP-15 Fee-Bump."* |
| 23 | Footer Disclaimer | Cảnh báo bản quyền & Demo | *"Lưu ý quan trọng: RentFlow hiện là bản demo tham gia cuộc thi Stellar Ideathon. Dịch vụ ngân hàng, VietQR, OTP, giải ngân và tài khoản ký quỹ hoàn toàn là mô phỏng. Smart contract Soroban không giữ tiền VNĐ. Mọi giao dịch blockchain được thực hiện trên Stellar Testnet và không có giá trị tiền tệ thực tế."* |

---

### 2.7. Trang Minh bạch (`/minh-bach`)

| STT | Mục | Nội dung kiểm toán | Đối chiếu mã nguồn (`CONTRACTS.md` & `resolve-args.ts`) |
|---|---|---|---|
| 24 | Mục 2 (Bảng On-chain / Off-chain) | Bảng phân chia ranh giới vật lý | Cập nhật đủ 5 nhóm: Danh tính PII, Hợp đồng & Thông số (`doc_hash`, `deposit`, `rent`, `due_day`, `late_fee_bps_per_day`), Trạng thái & Quá hạn (`days_late`, `new_due_ts`), Thanh toán cọc & Thuê (`payment_ref_hash`, `amount`, `period`), Khấu trừ & Tranh chấp (`reason_hash`, `amount`, `accept`, `agreed_amount`). |
| 25 | Mục 5 (Đạo đức AI) | Tuyên bố sử dụng AI | Khẳng định rõ: **"RentFlow khẳng định: Bản demo hiện tại TUYỆT ĐỐI KHÔNG SỬ DỤNG AI TRONG BẤT KỲ LUỒNG NGHIỆP VỤ NÀO (không dùng AI để chấm điểm tín nhiệm người thuê, không phán xét tranh chấp, không quyết định giải ngân)."** |
| 26 | Mục 6 (Danh mục mô phỏng) | 6 thành phần mô phỏng | Liệt kê đầy đủ: Ngân hàng ký quỹ (mô phỏng), VietQR & payOS (mô phỏng/test mode), Giải ngân hoàn cọc (mô phỏng), OTP qua SMS (mô phỏng 123456), Passkey (thử nghiệm với thiết bị ảo), eKYC khôi phục tài khoản (mô phỏng). |
| 27 | Mục 7 (Lộ trình chưa làm) | 7 hạng mục chưa làm | Liệt kê đầy đủ: SEP-24 Stellar Anchor, SEP-10, Lưu & băm ảnh bàn giao phòng, HSM/KMS FIPS 140-2, Kênh thông báo Email/SMS/Push, Khoản nợ điện nước, Trọng tài thương mại pháp lý. |

---

## 3. Tổng kết khắc phục các lỗi nói quá

Mọi cụm từ sau đây đã được rà soát và loại bỏ hoàn toàn khỏi giao diện người dùng:
1. ❌ *"Tuân thủ 100% pháp lý"* ➔ Thay bằng mô tả kiến trúc kỹ thuật và lưu ý mô phỏng.
2. ❌ *"Ngân hàng giải ngân tự động / Tiền chảy thẳng sang chủ nhà"* ➔ Nêu rõ hợp đồng Soroban chỉ phát sự kiện `release_authorized`, giải ngân tài khoản là mô phỏng.
3. ❌ *"Mã hóa ảnh bàn giao / Băm ảnh bàn giao lên chuỗi"* ➔ Xác nhận hiện chỉ băm nội dung văn bản hợp đồng (`terms_text`), tính năng ảnh bàn giao là lộ trình tương lai.
4. ❌ *"Cổng thanh toán payOS tự động"* ➔ Ghi rõ payOS chưa kiểm chứng thực tế, hệ thống chạy ở chế độ giả lập thanh toán.
5. ❌ *"Xác thực OTP SMS"* ➔ Ghi rõ dùng mã OTP mô phỏng `123456`.


## Cập nhật của Manager sau khi gộp Agent C

Tính năng ghi nhận khoản nợ điện, nước, phí dịch vụ đã có (chỉ off-chain, chủ nhà tự xác nhận đã nhận ngoài hệ thống). Mục "Phí điện nước" trong danh sách "Chưa làm" được đổi thành: chưa thanh toán các khoản này qua VietQR và chưa ghi lên chain.
