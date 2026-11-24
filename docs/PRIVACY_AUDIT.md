# Báo cáo Kiểm toán Quyền riêng tư & Bảo mật (Privacy & Security Audit)

Báo cáo kiểm toán bảo mật và quyền riêng tư dữ liệu của dự án **RentFlow** (Stellar Ideathon Track 4 & 5).
Thực hiện độc lập bởi Agent A (Vòng 4) trên mã nguồn thực tế và dữ liệu thật tại commit hiện tại.

---

## 1. Kết quả chạy công cụ quét tự động

Các lệnh kiểm toán an toàn thông tin được thực thi trực tiếp trên máy chủ cục bộ:

### 1.1 Quét lộ bí mật (Secret Scanner)
Lệnh thực thi:
```bash
node scripts/scan-secrets.mjs
```
Kết quả thực tế:
```text
==================================================
RentFlow Secret Scanner: Quét mã nguồn và Git history
==================================================

[1/2] Đang quét các file trong working tree...

[2/2] Đang quét lịch sử git commit...

==================================================
✅ HOÀN TẤT: Toàn bộ repository và lịch sử git sạch, không có secret bị lộ.
Exit Code: 0
```
- **Phạm vi quét:** Toàn bộ cây thư mục mã nguồn được theo dõi bởi Git (`git ls-files`) và lịch sử 50 commit gần nhất (`git log -p -n 50`).
- **Mẫu kiểm tra:** Stellar Secret Key (`S[A-Z2-7]{55}`), Private Key PEM, AWS Access Key (`AKIA...`), GitHub Personal Access Token (`ghp_...`, `gho_...`), và các chuỗi gán bí mật chung (`token`, `api_key`, `secret`, `password`).
- **Kết luận:** Mã nguồn và lịch sử commit hoàn toàn sạch, không có khóa bí mật nào bị rò rỉ.

### 1.2 Quét dữ liệu cá nhân trên On-chain (On-chain PII Scanner)
Lệnh thực thi:
```bash
node scripts/scan-pii.mjs
```
Kết quả thực tế:
```text
==================================================
RentFlow On-chain PII Scanner
==================================================

[1/2] Đang quét bảng onchain_txs từ Supabase...
Tìm thấy 12 giao dịch trong onchain_txs. Đang kiểm tra...

[2/2] Đang quét các file dữ liệu on-chain mẫu...

==================================================
✅ HOÀN TẤT: Dữ liệu on-chain hoàn toàn sạch PII, tuân thủ đạo đức Blockchain.
Exit Code: 0
```
- **Phạm vi quét:** Toàn bộ 12 giao dịch on-chain đã ghi nhận trong bảng `onchain_txs` trên cơ sở dữ liệu Supabase local cùng các tệp dữ liệu giả lập (`mock-data.ts`).
- **Quy tắc kiểm tra:** Quét các khóa cấm (`name`, `phone`, `email`, `cccd`, `address`, `room_label`, `terms_text`, `reason_text`, `avatar`...) và các mẫu biểu thức chính quy (SĐT Việt Nam, email, CCCD 9/12 số, văn bản tự do dài > 64 ký tự).
- **Kết luận:** 100% payload on-chain chỉ chứa UUID, địa chỉ ví Stellar, số tiền nguyên và mã băm SHA-256 có muối.

---

## 2. Kiểm toán tham số các hàm Contract được gọi từ Backend

Dưới đây là danh mục toàn bộ 16 hàm của Smart Contract Soroban (`contracts/rentflow/src/lib.rs`) được tích hợp với backend. Mỗi tham số được đối chiếu nguồn gốc dữ liệu và thẩm định lý do an toàn PII:

| STT | Tên hàm ABI | Người gọi (Auth) | Tham số gửi lên chain | Nguồn gốc dữ liệu trong DB / Backend | Vì sao KHÔNG phải dữ liệu cá nhân (PII) |
|:---:|---|---|---|---|---|
| 1 | `__constructor` / `init` | Deployer / Platform (`require_auth`) | `admin: Address`<br>`oracle: Address` | Khóa công khai từ `STELLAR_ADMIN_SECRET` và `STELLAR_ORACLE_SECRET` trong biến môi trường. | Chỉ là địa chỉ công khai Stellar (`G...`) của hệ thống nền tảng, không chứa bất kỳ danh tính người dùng nào. |
| 2 | `create_contract` | `landlord` (`require_auth`) | `id: BytesN<16>`<br>`landlord: Address`<br>`tenant: Address`<br>`doc_hash: BytesN<32>`<br>`deposit: i128`<br>`rent: i128`<br>`due_day: u32`<br>`late_fee_bps_per_day: u32` | - `id`: UUID hợp đồng (`rental_contracts.id`).<br>- `landlord`: `custody_wallets.stellar_public_key` của chủ nhà.<br>- `tenant`: `custody_wallets.stellar_public_key` của người thuê.<br>- `doc_hash`: SHA-256(`doc_salt` \|\| Canonical JSON) tính từ `canonicalizeContract`.<br>- `deposit`: `rental_contracts.deposit_amount`.<br>- `rent`: `rental_contracts.rent_amount`.<br>- `due_day`: `rental_contracts.due_day`.<br>- `late_fee_bps_per_day`: `rental_contracts.late_fee_bps_per_day`. | - UUID là định danh giả danh ngẫu nhiên (pseudonymous).<br>- Địa chỉ ví là chuỗi mã hóa công khai trên blockchain.<br>- Nội dung nhạy cảm (tên phòng, số nhà, điều khoản cá nhân) nằm 100% off-chain. On-chain chỉ giữ mã băm SHA-256 kèm muối 32-byte ngẫu nhiên, miễn nhiễm với tấn công dò ngược (rainbow table).<br>- Các trường số tiền và ngày là thông số tài chính trừu tượng. |
| 3 | `tenant_confirm` | `tenant` (`require_auth`) | `id: BytesN<16>`<br>`tenant: Address` | - `id`: UUID hợp đồng.<br>- `tenant`: `custody_wallets.stellar_public_key` của người thuê. | Chỉ bao gồm UUID hợp đồng và địa chỉ công khai ví của người thuê. Không có tên, số điện thoại hay thông tin cá nhân. |
| 4 | `record_deposit_paid` | `oracle` (`require_auth`) | `id: BytesN<16>`<br>`payment_ref_hash: BytesN<32>`<br>`amount: i128` | - `id`: UUID hợp đồng.<br>- `payment_ref_hash`: SHA-256(`payment_ref_salt` \|\| `provider:order_code`) sinh từ `payments`.<br>- `amount`: `payments.business_amount`. | Mã đơn hàng ngân hàng/VietQR gốc và muối được lưu off-chain. On-chain chỉ nhận mã băm có muối để chống phát lại (replay protection) và số tiền VND. Không có thông tin tài khoản ngân hàng. |
| 5 | `record_rent_paid` | `oracle` (`require_auth`) | `id: BytesN<16>`<br>`period: u32`<br>`amount: i128`<br>`payment_ref_hash: BytesN<32>` | - `id`: UUID hợp đồng.<br>- `period`: `rent_periods.period_no` (kỳ 1..12).<br>- `amount`: `payments.business_amount`.<br>- `payment_ref_hash`: SHA-256 có muối của mã giao dịch thanh toán. | Số kỳ, số tiền và mã băm mật mã học; hoàn toàn không có chi tiết định danh tài khoản ngân hàng của người trả tiền. |
| 6 | `mark_overdue` | `oracle` (`require_auth`) | `id: BytesN<16>`<br>`period: u32`<br>`days_late: u32` | - `id`: UUID hợp đồng.<br>- `period`: Số thứ tự kỳ thuê.<br>- `days_late`: Số ngày trễ hạn tính từ `rent_periods.due_date`. | Chỉ gồm các chỉ số thời gian và kỳ hạn dạng số nguyên, không chứa PII. |
| 7 | `calc_late_fee` | Bất kỳ ai (View) | `id: BytesN<16>`<br>`period: u32`<br>`days_late: u32` | Tham số truy vấn tính toán từ backend. | Hàm tính toán thuần túy dựa trên công thức quy định trong hợp đồng, trả về số tiền phạt `i128`. |
| 8 | `extend_due` | `landlord` (`require_auth`) | `id: BytesN<16>`<br>`period: u32`<br>`new_due_ts: u64` | - `id`: UUID hợp đồng.<br>- `period`: Số thứ tự kỳ thuê.<br>- `new_due_ts`: Unix timestamp thời hạn mới do chủ nhà cấp. | Chỉ gồm số thứ tự kỳ và mốc thời gian dạng số nguyên. |
| 9 | `request_refund` | `landlord` hoặc `tenant` (`require_auth`) | `id: BytesN<16>`<br>`party: Address` | - `id`: UUID hợp đồng.<br>- `party`: Địa chỉ ví của bên gửi yêu cầu hoàn cọc. | Chỉ gồm UUID và địa chỉ ví Stellar. |
| 10 | `approve_refund` | `landlord` hoặc `tenant` (`require_auth`) | `id: BytesN<16>`<br>`party: Address`<br>`refund_amount: i128` | - `id`: UUID hợp đồng.<br>- `party`: Địa chỉ ví bên duyệt.<br>- `refund_amount`: `deposits.landlord_refund_amount` hoặc `tenant_refund_amount`. | Chỉ gồm UUID, địa chỉ ví và số tiền hoàn trả đề xuất dạng số nguyên VND. |
| 11 | `propose_deduction` | `landlord` (`require_auth`) | `id: BytesN<16>`<br>`landlord: Address`<br>`amount: i128`<br>`reason_hash: BytesN<32>` | - `id`: UUID hợp đồng.<br>- `landlord`: Địa chỉ ví chủ nhà.<br>- `amount`: Số tiền đề xuất trừ (`deduction_requests.amount`).<br>- `reason_hash`: SHA-256(`reason_salt` \|\| `reason_text_NFC_LF`). | Nội dung lý do bằng chữ được giữ lại trong DB Supabase. Trên sổ cái chỉ lưu hash có muối 32-byte, ngăn chặn suy diễn nội dung riêng tư từ bảng băm từ điển. |
| 12 | `respond_deduction` | `tenant` (`require_auth`) | `id: BytesN<16>`<br>`tenant: Address`<br>`accept: bool` | - `id`: UUID hợp đồng.<br>- `tenant`: Địa chỉ ví người thuê.<br>- `accept`: Cờ boolean (đồng ý hoặc từ chối). | Chỉ là cờ boolean và địa chỉ ví, không có dữ liệu văn bản. |
| 13 | `open_dispute` | `landlord` hoặc `tenant` (`require_auth`) | `id: BytesN<16>`<br>`party: Address` | - `id`: UUID hợp đồng.<br>- `party`: Địa chỉ ví bên mở tranh chấp. | Chỉ gồm UUID và địa chỉ ví Stellar. |
| 14 | `resolve_dispute` | `landlord` hoặc `tenant` (`require_auth`) | `id: BytesN<16>`<br>`party: Address`<br>`agreed_amount: i128` | - `id`: UUID hợp đồng.<br>- `party`: Địa chỉ ví bên gửi xác nhận hòa giải.<br>- `agreed_amount`: Số tiền hoàn cọc thống nhất (`disputes.landlord_agreed_amount` / `tenant_agreed_amount`). | Chỉ gồm UUID, địa chỉ ví và số tiền cọc thỏa thuận chia sẻ. |
| 15 | `get_contract` | Bất kỳ ai (View) | `id: BytesN<16>` | UUID hợp đồng cần kiểm tra. | Chỉ đọc bản ghi `ContractRecord` (toàn bộ cấu trúc gồm hash và số tiền, không có PII). |
| 16 | `get_rent_period` | Bất kỳ ai (View) | `id: BytesN<16>`<br>`period: u32` | UUID hợp đồng và số kỳ. | Chỉ đọc bản ghi `RentPeriodRecord` (tiền đến hạn, tiền đã trả, trạng thái). |

---

## 3. Rà soát Response API và Log Server

Đã thực hiện rà soát chuyên sâu toàn bộ mã nguồn `src/` nhằm phát hiện các nguy cơ rò rỉ khóa bí mật, mã OTP và thông tin nhạy cảm.

### 3.1 Khóa bí mật ví Custody (`encrypted_secret`)
- **Kết quả Grep:**
  ```text
  src/lib/crypto/custody.ts:93:    encrypted_secret: encryptedSecret,
  src/lib/crypto/custody.ts:131:    .select("encrypted_secret")
  src/lib/crypto/custody.ts:135:  if (error || !data?.encrypted_secret) {
  src/lib/crypto/custody.ts:139:  const secret = decryptSecret(data.encrypted_secret);
  ```
- **Bằng chứng bảo mật:**
  1. Cột `encrypted_secret` chỉ được truy xuất duy nhất tại `src/lib/crypto/custody.ts` trong hàm nội bộ `withCustodyKeypair`.
  2. Không có bất kỳ API Route Handler nào (`src/app/api/**`) thực hiện `SELECT` cột `encrypted_secret` hoặc trả về thông tin này trong HTTP response.
  3. Tại tầng cơ sở dữ liệu PostgreSQL (`supabase/migrations/20261123000000_init_schema.sql` dòng 278-279 và `20261124030000_lock_functions.sql` dòng 239-240):
     ```sql
     revoke all on public.custody_wallets from public, anon, authenticated;
     grant select (user_id, stellar_public_key, key_version, created_at) on public.custody_wallets to authenticated;
     ```
     Quyền truy cập cột `encrypted_secret` đã bị tước bỏ hoàn toàn đối với các vai trò `anon` và `authenticated`. Ngay cả khi người dùng thực hiện truy vấn thô `SELECT * FROM custody_wallets`, cơ sở dữ liệu sẽ chặn ở cấp độ cột. Chỉ tiến trình backend chạy bằng `service_role` mới có thể đọc trường này.
  4. Quá trình giải mã bằng `decryptSecret` chỉ giữ biến trong phạm vi hàm (memory scope) và được giải phóng tự động bởi Garbage Collector, không lưu vào log.

### 3.2 Mã OTP và Xác thực người dùng
- **Tại `src/app/api/auth/otp/request/route.ts`:**
  - Dòng 56-62: Mã OTP sinh ra chỉ được lưu vào bảng `auth_otps` trong database. Mã nguồn ghi chú rõ: `// Store in DB - do NOT log OTP`.
  - Dòng 64-72: Phản hồi trả về client chỉ chứa:
    ```json
    {
      "success": true,
      "phone": "0900000001",
      "isDemo": true,
      "expiresInSeconds": 300,
      "message": "Mã OTP mô phỏng đã được tạo..."
    }
    ```
    Mã số OTP (`code`) hoàn toàn **không** xuất hiện trong JSON response.
- **Tại `src/app/api/auth/otp/verify/route.ts`:**
  - Dòng 60-66: Khi người dùng nhập sai, số lần thử `attempts` tăng lên và chỉ trả lỗi `ApiError("VALIDATION_ERROR")`.
  - Dòng 70: Khi xác thực thành công, bản ghi OTP lập tức bị **xóa khỏi database (`delete()`)**, ngăn chặn việc sử dụng lại.
  - Dòng 142: Phản hồi trả về chỉ gồm thông tin phiên `user` (`id, role, fullName, phone`), không lộ bất kỳ token nhạy cảm nào.

### 3.3 Log Server và Lọc lỗi (Sanitization)
- **Rà soát `console.log` / `console.error`:**
  - Trong `src/lib/api/http.ts` dòng 47:
    ```ts
    console.error("[api] unhandled error:", error instanceof Error ? error.name : typeof error);
    ```
    Hệ thống chỉ in tên lỗi (`error.name`), không in thông điệp chi tiết hay stack trace có thể chứa dữ liệu nhạy cảm ra log server.
  - Trong `src/lib/crypto/custody.ts` dòng 62:
    ```ts
    console.warn("[custody] Friendbot funding warning:", err instanceof Error ? err.name : "request_failed");
    ```
    Lỗi từ Friendbot chỉ in `err.name`, không log URL chứa khóa công khai nếu không cần thiết.
- **Cơ chế tẩy uế lỗi on-chain (`sanitizeError`):**
  - Trong `src/lib/stellar/pii.ts` dòng 144-220: Hàm `sanitizeError` tự động quét và xóa bỏ mọi khóa bí mật Stellar (mẫu `S[A-Z2-7]{55}`), URL kết nối database, chuỗi ký tự dài nhạy cảm trước khi lưu vào cột `onchain_txs.error` hoặc trả về cho client.

---

## 4. Ghi nhận lỗi và các điểm lưu ý ngoài phạm vi

Qua quá trình rà soát toàn diện, hệ thống không phát hiện lỗ hổng nghiêm trọng nào thuộc phạm vi mã nguồn được kiểm tra. Tuy nhiên, để đảm bảo tính an toàn tối đa khi đưa lên môi trường Production thực tế, các điểm sau cần được nhóm phát triển ghi nhận:

1. **Cờ bypass xác thực bước hai trong chế độ Demo (`DEMO_MODE=true`):**
   - **Tệp:** `src/lib/crypto/step-up.ts`, dòng 43-45 và 60-62.
   - **Hiện trạng:** Khi `process.env.DEMO_MODE === "true"`, hệ thống cho phép header `x-step-up-token: demo-step-up` bỏ qua xác thực Passkey/OTP để phục vụ các script kiểm thử tự động e2e.
   - **Khuyến nghị cho Production:** Bắt buộc phải tắt biến môi trường `DEMO_MODE=false` trên máy chủ chính thức để đóng hoàn toàn cơ chế bypass này.
2. **Khóa chủ Custody nằm trong biến môi trường:**
   - **Tệp:** `src/lib/crypto/custody.ts`, dòng 7.
   - **Hiện trạng:** `CUSTODY_MASTER_KEY` đang được cấu hình qua biến môi trường tĩnh `.env.local`.
   - **Khuyến nghị cho Production:** Cần chuyển sang sử dụng dịch vụ quản lý khóa chuyên nghiệp trên đám mây (Cloud KMS như AWS KMS, Google Cloud KMS) hoặc Hardware Security Module (HSM) với cơ chế xoay vòng khóa tự động (Key Rotation).
3. **Mã PIN OTP cố định cho số điện thoại demo:**
   - **Tệp:** `src/app/api/auth/otp/request/route.ts` dòng 50-52 và `verify/route.ts` dòng 38-41.
   - **Hiện trạng:** Các số điện thoại `0900000001`, `0900000002`, `0900000003` luôn nhận OTP là `123456` khi `DEMO_MODE=true`.
   - **Khuyến nghị:** Đây là tính năng phục vụ Ban giám khảo chấm thi và chạy demo; cần loại bỏ logic này khi kết nối cổng gửi tin nhắn SMS Brandname thực tế.
