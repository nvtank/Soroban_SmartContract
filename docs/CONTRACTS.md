# RentFlow — Hợp đồng giao tiếp chung

Mọi thay đổi enum, schema, API hoặc ABI phải được Manager duyệt và cập nhật ở đây **trước** khi code.

## 1. Phiên bản đã cài

Next.js 16.4.6 · React 19.3.0 · TypeScript 5 · Tailwind 4.3.3 · gsap 3.15.1 · @gsap/react 2.1.2 · lenis 1.3.27 · @supabase/supabase-js 2.119.2 · @supabase/ssr 0.12.7 · @payos/node 2.0.6 · @stellar/stellar-sdk 17.4.0 · @simplewebauthn/server 14.1.0 · @simplewebauthn/browser 14.0.0 · zod 4.6.7 · lucide-react 1.78.0 · vitest 5.1.1 · @playwright/test 1.65.1

Lưu ý: Next.js 16 có thay đổi lớn và đang bật `cacheComponents`. Đọc `node_modules/next/dist/docs/` trước khi viết route hoặc page. Tailwind 4 đặt token trong `src/app/globals.css`.

## 2. Trạng thái

Nguồn sự thật: `src/domain/states.ts`. Bản Rust: `contracts/rentflow/src/types.rs`. Mã u32 on-chain là chỉ số trong mảng TS. `tests/unit/states-sync.test.ts` chặn lệch giữa hai bên.

| Máy | Chuyển hợp lệ |
|---|---|
| Contract | `PENDING_CONFIRMATION → ACTIVE, CANCELLED` · `ACTIVE → ENDED` |
| Deposit | `UNPAID → RECORDED` · `RECORDED → PENDING_REFUND, PENDING_DISPUTE` · `PENDING_REFUND → REFUNDED, DEDUCTED, PENDING_DISPUTE` · `PENDING_DISPUTE → REFUNDED, DEDUCTED` (chỉ khi dispute `RESOLVED`) |
| Rent | `NOT_DUE → AWAITING_PAYMENT` · `AWAITING_PAYMENT → PAID, PARTIALLY_PAID, OVERDUE` · `PARTIALLY_PAID → PARTIALLY_PAID, PAID, OVERDUE` · `OVERDUE → OVERDUE, PARTIALLY_PAID, PAID, AWAITING_PAYMENT` (gia hạn) |
| Dispute | `NONE → IN_PROGRESS` · `IN_PROGRESS → AWAITING_CONFIRMATION` · `AWAITING_CONFIRMATION → RESOLVED, IN_PROGRESS` |
| Payment | `PENDING → CONFIRMED, FAILED, UNDERPAID, OVERPAID, EXPIRED` · `UNDERPAID → CONFIRMED, OVERPAID` |
| Deduction | `PROPOSED → ACCEPTED, REJECTED` |
| On-chain tx | `PENDING → SUBMITTED, FAILED` · `SUBMITTED → CONFIRMED, FAILED` · `FAILED → PENDING` |

Đổi trạng thái cọc **bắt buộc** qua `assertDepositTransition(from, to, dispute)`.

## 3. Quyết định thiết kế của Manager

1. **Hash có salt.** Băm trần văn bản ngắn (lý do khấu trừ, mã đơn) có thể bị dò ngược, nên vi phạm quy tắc không lộ dữ liệu. Mọi hash on-chain dùng salt ngẫu nhiên 32 byte lưu off-chain:
   - `doc_hash = SHA-256(salt || canonical_bytes)`, `reason_hash` tương tự.
   - `payment_ref_hash = SHA-256(salt || UTF-8(provider:order_code))`.
   - Hai bên hợp đồng được xem salt để tự kiểm chứng. UUID on-chain không dùng làm salt vì nó công khai.
2. **Chuẩn hóa nội dung trước khi băm.** JSON khóa sắp theo thứ tự byte, không khoảng trắng, chuỗi Unicode NFC, xuống dòng `\n`, tiền là chuỗi số nguyên, ngày `YYYY-MM-DD`, mã hóa UTF-8. Trường: `contract_id, room_label, rent_amount, deposit_amount, start_date, end_date, due_day, late_fee_bps_per_day, terms_text`.
3. **Hai loại số tiền.** `payments.business_amount` là số theo hợp đồng và là số ghi on-chain. `payments.expected_amount` là số thực thu qua cổng (ở payOS demo là `DEMO_PAYMENT_AMOUNT`). Đối chiếu đủ/thiếu/thừa dùng `expected_amount`. UI phải ghi "Số tiền thanh toán thử nghiệm".
4. **Ký giao dịch.** `PLATFORM` là source account và trả phí. Người dùng ký **Soroban auth entry** bằng khóa custody. Fee-Bump là P1. Ví custody vẫn cần được Friendbot tạo trên Testnet.
5. **Tiền** là số nguyên VND: `bigint` trong DB, `i128` on-chain, chuỗi trong JSON API.
6. **Phí trễ** làm tròn xuống: `late_fee = rent * bps * days / 10000`.

## 4. Schema DB

Migration ở `supabase/migrations/`. Bảng và cột theo mục 5.2 của brief, bổ sung:

- `rental_contracts.doc_salt`
- `deduction_requests.reason_salt`
- `payments.business_amount`, `payments.payment_ref_salt`
- `disputes`: `landlord_agreed_amount`, `tenant_agreed_amount`
- `deposits`: `landlord_refund_amount`, `tenant_refund_amount`

RLS: người dùng chỉ đọc dữ liệu hợp đồng mình tham gia. `payments`, `payment_events`, `onchain_txs`, `custody_wallets` chỉ ghi bằng service role. Client không bao giờ đọc được `custody_wallets.encrypted_secret`.

## 5. API

Thành công: `{ "data": ... }`. Lỗi: `{ "error": { "code": "VALIDATION_ERROR", "message": "…tiếng Việt…", "details": {} } }`. Mã lỗi là khóa của `vi.errors` trong `src/i18n/vi.ts`.

| Nhóm | Route | Chủ |
|---|---|---|
| Auth | `POST /api/auth/otp/{request,verify}` · `POST /api/auth/passkey/register/{options,verify}` · `POST /api/auth/passkey/auth/{options,verify}` · `POST /api/recovery/request` | B |
| Hợp đồng | `POST,GET /api/contracts` · `GET /api/contracts/[id]` · `POST /api/contracts/[id]/confirm` | C |
| Hoàn cọc | `POST /api/contracts/[id]/refund/{request,approve}` · `POST /api/contracts/[id]/deduction/propose` · `POST /api/deductions/[id]/respond` · `POST /api/contracts/[id]/dispute/open` | C |
| Thanh toán | `POST /api/contracts/[id]/deposit/pay` · `POST /api/contracts/[id]/rent/[period]/pay` · `POST /api/payments/payos/webhook` · `POST /api/payments/[id]/simulate-{confirm,fail}` | E (route `pay` nằm trong thư mục của C, xem HANDOFF) |
| On-chain | `GET /api/contracts/[id]/onchain` · `POST /api/onchain/[id]/retry` · `POST /api/jobs/flush-onchain` | D |
| Job, demo | `POST /api/jobs/overdue-scan` · `POST /api/demo/{seed,reset}` · `GET /api/health` | C, H |

## 6. ABI Soroban (bản thiết kế, chưa deploy)

`Contract ID (Testnet):` _chưa có_

```text
init(admin: Address, oracle: Address)
create_contract(id: BytesN<16>, landlord: Address, tenant: Address, doc_hash: BytesN<32>, deposit: i128, rent: i128, due_day: u32, late_fee_bps_per_day: u32)
tenant_confirm(id, tenant: Address)
record_deposit_paid(id, payment_ref_hash: BytesN<32>, amount: i128)            // oracle
record_rent_paid(id, period: u32, amount: i128, payment_ref_hash: BytesN<32>)  // oracle
mark_overdue(id, period: u32, days_late: u32)                                  // oracle
calc_late_fee(id, period: u32, days_late: u32) -> i128                         // view
extend_due(id, period: u32, new_due_ts: u64)                                   // landlord
request_refund(id, party: Address)
approve_refund(id, party: Address, refund_amount: i128)
propose_deduction(id, landlord: Address, amount: i128, reason_hash: BytesN<32>)
respond_deduction(id, tenant: Address, accept: bool)
open_dispute(id, party: Address)
resolve_dispute(id, party: Address, agreed_amount: i128)
get_contract(id) -> ContractRecord                                             // view
get_rent_period(id, period: u32) -> RentPeriodRecord                           // view
```

Mã lỗi: enum `Error` trong `types.rs`. Mỗi lần đổi trạng thái phát một event. Đủ điều kiện giải ngân thì phát `release_authorized`.

**Cấm on-chain:** tên, SĐT, CCCD, địa chỉ, ảnh, văn bản hợp đồng, lý do dạng chữ, `room_label`.
