# RentFlow

Dịch vụ bảo chứng tiền cọc và thu tiền thuê nhà tự động. Dự án Ideathon Stellar, Track 4 (Ví chuyên biệt, Custody) kết hợp Track 5 (Soroban).

> **Bản demo:** ngân hàng, VietQR, OTP và giải ngân là **mô phỏng**. Blockchain chạy trên **Stellar Testnet**, không có giá trị tiền thật. payOS chỉ là cổng tạo mã thanh toán, **không** phải tài khoản escrow.

## Những gì chạy thật và những gì mô phỏng

| Thành phần                                                      | Trạng thái                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Smart contract Soroban trên Stellar Testnet                     | **Thật** (`CCDNF4D4HRIDYSHBEOV2IYC2XQSTD7VPSFZ4NSGCT2QVDPJ7RX4UBVXU`) |
| Hàng đợi ghi on-chain, thử lại, Fee-Bump (CAP-15)               | **Thật**                                                              |
| Passkey (WebAuthn), mã bước hai dùng một lần                    | **Thật** (đã thử với thiết bị Passkey ảo, chưa thử điện thoại thật)   |
| Database, phân quyền RLS, nhật ký                               | **Thật**                                                              |
| Đăng nhập OTP                                                   | Mô phỏng (mã `123456`, chưa có SMS)                                   |
| VietQR, xác nhận tiền về, tài khoản escrow ngân hàng, giải ngân | **Mô phỏng**                                                          |
| payOS                                                           | Có mã, **chưa kiểm chứng** (chưa có khóa)                             |
| SEP-10, Stellar Anchor                                          | **Chưa làm** (lộ trình)                                               |

Chi tiết đối chiếu yêu cầu: `docs/REQUIREMENTS_CHECK.md`. Kết quả kiểm thử: `docs/TEST_REPORT.md`. Kịch bản trình diễn: `docs/DEMO_SCRIPT.md`.

## Chạy trên máy local

Yêu cầu: Node 20+, pnpm, Docker. Để deploy lại contract cần thêm Rust và Stellar CLI.

```bash
pnpm install
cp .env.example .env.local          # rồi điền theo mục Biến môi trường
pnpm dlx supabase start             # Supabase local, API cổng 54421, DB cổng 54422
pnpm dev -p 3112 -H 127.0.0.1       # mở http://localhost:3112
```

Mở bằng `http://localhost:3112` (**không** dùng `127.0.0.1`), nếu không Passkey sẽ không hoạt động vì tên miền không khớp `WEBAUTHN_RP_ID`.

Nạp dữ liệu demo: đăng nhập rồi vào **Admin demo** bấm "Chuẩn bị kịch bản demo", hoặc:

```bash
curl -X POST -H "origin: http://localhost:3112" http://localhost:3112/api/demo/prepare
```

Tài khoản demo (OTP mô phỏng `123456`): chủ nhà `0900000001`, người thuê `0900000002` và `0900000003`.

## Biến môi trường

Xem `.env.example`. Các nhóm chính:

| Nhóm       | Biến                                                                                       | Ghi chú                                              |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Ứng dụng   | `DEMO_MODE`, `NEXT_PUBLIC_APP_URL`, `SESSION_SECRET`, `CRON_SECRET`                        | `SESSION_SECRET` tối thiểu 32 ký tự ngẫu nhiên       |
| Supabase   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`   | Khóa service role chỉ ở server                       |
| Ví custody | `CUSTODY_MASTER_KEY`                                                                       | `openssl rand -base64 32`. Bản thật cần HSM hoặc KMS |
| Stellar    | `STELLAR_CONTRACT_ID`, `STELLAR_*_SECRET`, `STELLAR_ENABLE_FEE_BUMP`, `ONCHAIN_AUTO_FLUSH` | Khóa tạo bởi `scripts/deploy-contract.sh`            |
| Passkey    | `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`                                                        | Phải khớp tên miền và cổng đang chạy                 |
| Thanh toán | `PAYMENT_MODE`, `PAYOS_*`, `DEMO_PAYMENT_AMOUNT`                                           | Mặc định mô phỏng                                    |

Khi `DEMO_MODE=true`, API vẫn nhận mã bỏ qua bước hai `demo-step-up` (dùng cho kịch bản kiểm thử). **Không bật `DEMO_MODE` ở môi trường thật.**

## Deploy contract

```bash
bash scripts/deploy-contract.sh --dry-run   # chỉ build và in kế hoạch
bash scripts/deploy-contract.sh             # deploy lên Testnet, ghi ID vào .env.local
```

Script từ chối chạy nếu thư mục `contracts/` chưa commit và không deploy lại nếu đã có `STELLAR_CONTRACT_ID` (dùng `--force` để ép).

## Kiểm thử

```bash
pnpm test                       # unit và tích hợp (xóa dữ liệu demo, chạy xong cần chuẩn bị lại)
pnpm typecheck && pnpm lint
node scripts/e2e-flow.mjs       # luồng chính trên app đang chạy
node scripts/e2e-extra.mjs      # phạt trễ, hoàn cọc, tranh chấp, gia hạn
node scripts/scan-secrets.mjs   # quét bí mật
node scripts/scan-pii.mjs       # quét dữ liệu cá nhân trong giao dịch on-chain
```

## Cấu trúc

```text
contracts/rentflow/   Smart contract Soroban (Rust) và test
supabase/migrations/  Schema, RLS, hàm SQL
src/app/              Giao diện (marketing, app) và API (route handlers)
src/domain/           Nghiệp vụ, máy trạng thái, hash có muối
src/lib/stellar/      Hàng đợi on-chain, mã hóa tham số, ký, Fee-Bump
src/lib/crypto/       Ví custody (AES-256-GCM), Passkey, bước hai
src/lib/demo/         Kịch bản demo chạy qua API thật
scripts/              Deploy, quét bảo mật, kịch bản kiểm thử
docs/                 CONTRACTS, ABI, REQUIREMENTS_CHECK, TEST_REPORT, DEMO_SCRIPT
```

## Nguyên tắc về dữ liệu

Trên blockchain chỉ có: UUID hợp đồng, địa chỉ ví Stellar, hash SHA-256 có muối, số tiền, trạng thái. **Không** có họ tên, số điện thoại, CCCD, địa chỉ, ảnh, nội dung hợp đồng hay lý do khấu trừ dạng chữ. Dự án không dùng AI trong luồng nghiệp vụ. Hai con số về đợt kiểm tra PCCC hiển thị kèm nhãn "Chưa xác minh nguồn".
