# RentFlow Smart Contract ABI & Specification

Tài liệu đặc tả Smart Contract Soroban của dự án **RentFlow** (Track 4/5 Stellar Ideathon).
Bản đã deploy lên Stellar Testnet (xem docs/CONTRACTS.md); phục vụ tích hợp với backend/frontend và kiểm thử.

---

## 1. Thông tin bản Build & WASM

| Thuộc tính | Giá trị |
|---|---|
| **Crate** | `rentflow` (v0.1.0) |
| **Soroban SDK** | `29.0.1` |
| **Stellar CLI** | `30.0.1` |
| **Rust Toolchain** | `stable-x86_64-unknown-linux-gnu` / target `wasm32v1-none` |
| **WASM Path** | `contracts/rentflow/target/wasm32v1-none/release/rentflow.wasm` |
| **WASM Size** | `19,927 bytes` (19.46 KB tối ưu hóa; kích thước gốc 24,427 bytes) |
| **WASM SHA-256** | `ad01f9a54b66e78109d86f35b860148aa57fe0c03898e722b6185b818e38f8f6` |
| **Số hàm export** | 16 hàm (1 constructor + 12 mutation + 3 query/view) |
| **Clippy Status** | `cargo clippy --all-targets` sạch 100%, 0 warning, 0 error |
| **Unit/Adversarial Tests** | 29/29 passed (bao gồm property-based random sequence fuzzing) |

---

## 2. Bảng đối chiếu trạng thái với `src/domain/states.ts`

Smart contract tuân thủ nghiêm ngặt bảng chuyển trạng thái của hệ thống được định nghĩa tại `src/domain/states.ts`.
Mọi hành vi chuyển trạng thái sai hoặc gọi hàm khi hợp đồng đã ở trạng thái kết thúc (`Ended`) đều bị từ chối với mã lỗi `Error::InvalidTransition`.

| Hàm ABI | Người được gọi (Caller & Auth) | Trạng thái vào | Trạng thái ra | Ràng buộc nghiệp vụ & ghi chú |
|---|---|---|---|---|
| `__constructor` | Deployer | Chưa khởi tạo | Instance storage lưu `Admin`, `Oracle` | Chỉ chạy 1 lần khi deploy WASM |
| `create_contract` | `landlord` (`require_auth`) | Hợp đồng chưa tồn tại | `Contract: PendingConfirmation`<br>`Deposit: Unpaid`<br>`Dispute: None` | `deposit > 0`, `rent > 0`, `due_day ∈ [1, 31]`, `late_fee_bps <= 10000`, `landlord != tenant` |
| `tenant_confirm` | `tenant` (`require_auth`) | `Contract: PendingConfirmation` | `Contract: Active` | Chỉ đúng tenant của hợp đồng mới được xác nhận |
| `record_deposit_paid` | `oracle` (`require_auth`) | `Contract: Active`<br>`Deposit: Unpaid` | `Deposit: Recorded` | `amount == deposit_amount`. Chặn replay `payment_ref_hash` |
| `record_rent_paid` | `oracle` (`require_auth`) | `Contract: Active`<br>`Rent: AwaitingPayment / PartiallyPaid / Overdue` | `Rent: PartiallyPaid` (nếu thiếu)<br>`Rent: Paid` (nếu đủ/thừa) | `period >= 1`, `amount > 0`. Không cho trả tiếp kỳ đã `Paid`. Chặn replay `payment_ref_hash` |
| `mark_overdue` | `oracle` (`require_auth`) | `Contract: Active`<br>`Rent: AwaitingPayment / PartiallyPaid / Overdue` | `Rent: Overdue` | `period >= 1`. Tính `late_fee = rent * bps * days / 10000` (có kiểm tra `Overflow`). Không đánh dấu quá hạn kỳ đã `Paid` |
| `calc_late_fee` | Bất kỳ ai (View) | Hợp đồng tồn tại | Không đổi trạng thái | Trả về `i128` phí trễ. Bumps instance + persistent TTL |
| `extend_due` | `landlord` (`require_auth`) | `Contract: Active`<br>`Rent: Overdue` | `Rent: AwaitingPayment` | `period >= 1`. Reset `late_days = 0`, `late_fee = 0`, cập nhật `due_date_ts` |
| `request_refund` | `landlord` hoặc `tenant` (`require_auth`) | `Contract: Active`<br>`Deposit: Recorded / PendingRefund`<br>`Dispute: None` | `Deposit: PendingRefund` | Báo hiệu bắt đầu luồng nghiệm thu & hoàn cọc |
| `approve_refund` | `landlord` hoặc `tenant` (`require_auth`) | `Contract: Active`<br>`Deposit: Recorded / PendingRefund`<br>`Dispute: None` | 1 bên phê duyệt: `Deposit: PendingRefund`<br>Cả 2 bên khớp tiền: `Contract: Ended`, `Deposit: Refunded` (nếu trả đủ cọc) hoặc `Deducted` (nếu khấu trừ một phần) | `0 <= refund_amount <= deposit_amount`. Không cho phép khi đang có `DeductionProposal`. Khi cả 2 khớp số tiền: phát `release_authorized` duy nhất 1 lần |
| `propose_deduction` | `landlord` (`require_auth`) | `Contract: Active`<br>`Deposit: Recorded / PendingRefund`<br>`Dispute: None` | `Deposit: PendingRefund` | `0 < amount <= deposit_amount`. Xóa các phê duyệt hoàn cọc cũ. Lưu `DeductionProposal(amount, reason_hash)` |
| `respond_deduction` | `tenant` (`require_auth`) | `Contract: Active`<br>`Deposit: PendingRefund`<br>`Dispute: None`<br>Có `DeductionProposal` | Chấp nhận (`accept=true`): `Contract: Ended`, `Deposit: Deducted`<br>Từ chối (`accept=false`): `Deposit: PendingDispute`, `Dispute: InProgress` | Chấp nhận: tính `refund = deposit - amount`, phát `release_authorized` 1 lần.<br>Từ chối: tự động mở tranh chấp, xóa các phê duyệt cũ |
| `open_dispute` | `landlord` hoặc `tenant` (`require_auth`) | `Contract: Active`<br>`Deposit: Recorded / PendingRefund` | `Deposit: PendingDispute`<br>`Dispute: InProgress` | Xóa mọi đề xuất khấu trừ và phê duyệt hoàn cọc cũ. Khóa cọc, không cho giải ngân |
| `resolve_dispute` | `landlord` hoặc `tenant` (`require_auth`) | `Contract: Active`<br>`Dispute: InProgress / AwaitingConfirmation` | 1 bên gửi: `Dispute: AwaitingConfirmation`<br>Cả 2 khớp số tiền: `Contract: Ended`, `Dispute: Resolved`, `Deposit: Refunded/Deducted`<br>2 bên lệch tiền: `Dispute: InProgress` | `0 <= agreed_amount <= deposit_amount`. Chỉ khi cả 2 bên thống nhất cùng 1 số tiền mới `Resolved` và phát `release_authorized` duy nhất 1 lần. Nếu số tiền lệch: reset về `InProgress`, xóa số đã lưu |
| `get_contract` | Bất kỳ ai (View) | Hợp đồng tồn tại | Không đổi trạng thái | Trả về `ContractRecord`. Tự động gia hạn (bump) instance TTL và persistent TTL |
| `get_rent_period` | Bất kỳ ai (View) | Kỳ thuê tồn tại | Không đổi trạng thái | `period >= 1`. Trả về `RentPeriodRecord`. Tự động gia hạn (bump) instance TTL và persistent TTL |

---

## 3. Danh sách hàm và Chi tiết Chữ ký ABI

### 3.1 `__constructor`
Khởi tạo thông tin quản trị và oracle khi deploy contract.
```rust
pub fn __constructor(env: Env, admin: Address, oracle: Address)
```
- `admin`: Địa chỉ quản trị nền tảng (Platform/Admin).
- `oracle`: Địa chỉ Oracle backend có thẩm quyền ghi nhận thanh toán VietQR và quá hạn.
- Sự kiện phát: `((admin, init), (admin, oracle))`

### 3.2 `create_contract`
Chủ nhà tạo hợp đồng thuê mới trên sổ cái Stellar.
```rust
pub fn create_contract(
    env: Env,
    id: BytesN<16>,
    landlord: Address,
    tenant: Address,
    doc_hash: BytesN<32>,
    deposit: i128,
    rent: i128,
    due_day: u32,
    late_fee_bps_per_day: u32,
) -> Result<(), Error>
```
- Xác thực: `landlord.require_auth()`.
- Ràng buộc: `landlord != tenant`, `deposit > 0`, `rent > 0`, `1 <= due_day <= 31`, `late_fee_bps_per_day <= 10000` (tối đa 100%/ngày).
- Sự kiện phát: `((contract, created), (id, landlord, tenant))`

### 3.3 `tenant_confirm`
Người thuê ký xác nhận hợp đồng (chuyển trạng thái sang `Active`).
```rust
pub fn tenant_confirm(env: Env, id: BytesN<16>, tenant: Address) -> Result<(), Error>
```
- Xác thực: `tenant.require_auth()`. Phải khớp với `contract.tenant`.
- Sự kiện phát: `((contract, confirmed), (id, tenant))`

### 3.4 `record_deposit_paid`
Oracle ghi nhận tiền cọc đã được thanh toán đủ qua VietQR/payOS.
```rust
pub fn record_deposit_paid(
    env: Env,
    id: BytesN<16>,
    payment_ref_hash: BytesN<32>,
    amount: i128,
) -> Result<(), Error>
```
- Xác thực: `oracle.require_auth()`.
- Ràng buộc: `amount == contract.deposit_amount`. `payment_ref_hash` chưa từng được sử dụng trong hợp đồng.
- Sự kiện phát: `((deposit, recorded), (id, payment_ref_hash, amount))`

### 3.5 `record_rent_paid`
Oracle ghi nhận thanh toán kỳ thuê (hỗ trợ trả một phần hoặc trả đủ).
```rust
pub fn record_rent_paid(
    env: Env,
    id: BytesN<16>,
    period: u32,
    amount: i128,
    payment_ref_hash: BytesN<32>,
) -> Result<(), Error>
```
- Xác thực: `oracle.require_auth()`.
- Ràng buộc: `period >= 1`, `amount > 0`. Kỳ thuê chưa ở trạng thái `Paid`. Chặn trùng `payment_ref_hash`.
- Sự kiện phát: `((rent, paid), (id, period, amount, payment_ref_hash))`

### 3.6 `mark_overdue`
Oracle ghi nhận kỳ thuê quá hạn và áp dụng phí phạt trễ hạn.
```rust
pub fn mark_overdue(env: Env, id: BytesN<16>, period: u32, days_late: u32) -> Result<(), Error>
```
- Xác thực: `oracle.require_auth()`.
- Ràng buộc: `period >= 1`. Kỳ thuê chưa `Paid`.
- Công thức: `late_fee = rent_amount * late_fee_bps_per_day * days_late / 10000`.
- Sự kiện phát: `((rent, overdue), (id, period, days_late, late_fee))`

### 3.7 `calc_late_fee`
Hàm view tính thử phí trễ hạn mà không làm thay đổi trạng thái.
```rust
pub fn calc_late_fee(env: Env, id: BytesN<16>, period: u32, days_late: u32) -> Result<i128, Error>
```
- Bumps TTL instance và persistent storage.

### 3.8 `extend_due`
Chủ nhà gia hạn thời hạn nộp tiền cho một kỳ thuê đang quá hạn (miễn/reset phí trễ).
```rust
pub fn extend_due(env: Env, id: BytesN<16>, period: u32, new_due_ts: u64) -> Result<(), Error>
```
- Xác thực: `contract.landlord.require_auth()`.
- Ràng buộc: Kỳ thuê phải đang ở trạng thái `Overdue`.
- Reset: `late_days = 0`, `late_fee = 0`, `status = AwaitingPayment`.
- Sự kiện phát: `((rent, extended), (id, period, new_due_ts))`

### 3.9 `request_refund`
Một trong hai bên yêu cầu mở quy trình hoàn trả cọc khi kết thúc thuê.
```rust
pub fn request_refund(env: Env, id: BytesN<16>, party: Address) -> Result<(), Error>
```
- Xác thực: `party.require_auth()` (`party == landlord || party == tenant`).
- Sự kiện phát: `((deposit, refund_requested), (id, party))`

### 3.10 `approve_refund`
Phê duyệt số tiền hoàn cọc. Khi cả hai bên khớp cùng một số tiền, hợp đồng kết thúc và phát lệnh giải ngân mô phỏng.
```rust
pub fn approve_refund(
    env: Env,
    id: BytesN<16>,
    party: Address,
    refund_amount: i128,
) -> Result<(), Error>
```
- Xác thực: `party.require_auth()` (`landlord` hoặc `tenant`).
- Ràng buộc: `0 <= refund_amount <= deposit_amount`. Không có tranh chấp active. Không có đề xuất khấu trừ đang chờ.
- Bất biến bảo toàn: `deducted_amount = deposit_amount - refund_amount`. `refund_amount + deducted_amount == deposit_amount`.
- Sự kiện phát khi hoàn tất:
  - `((release_authorized,), (id, refund_amount, deducted_amount))`
  - `((deposit, refunded), (id, refund_amount))`

### 3.11 `propose_deduction`
Chủ nhà đề xuất khấu trừ một phần hoặc toàn bộ tiền cọc (kèm băm SHA-256 lý do).
```rust
pub fn propose_deduction(
    env: Env,
    id: BytesN<16>,
    landlord: Address,
    amount: i128,
    reason_hash: BytesN<32>,
) -> Result<(), Error>
```
- Xác thực: `landlord.require_auth()`. Phải đúng chủ nhà của hợp đồng.
- Ràng buộc: `0 < amount <= deposit_amount`.
- Tự động xóa các phê duyệt hoàn cọc cũ để chống stale approvals.
- Sự kiện phát: `((deduction, proposed), (id, amount, reason_hash))`

### 3.12 `respond_deduction`
Người thuê phản hồi đề xuất khấu trừ (chấp nhận hoặc từ chối).
```rust
pub fn respond_deduction(
    env: Env,
    id: BytesN<16>,
    tenant: Address,
    accept: bool,
) -> Result<(), Error>
```
- Xác thực: `tenant.require_auth()`. Phải đúng người thuê của hợp đồng.
- Nếu `accept == true`:
  - Khấu trừ được chấp nhận. `refund_amount = deposit - amount`, `deducted_amount = amount`.
  - Hợp đồng sang `Ended`, cọc sang `Deducted`.
  - Phát sự kiện: `((release_authorized,), (id, refund, amount))` và `((deduction, accepted), (id, amount))`.
- Nếu `accept == false`:
  - Khấu trừ bị từ chối. Hợp đồng tự động chuyển sang `PendingDispute`, `dispute_status = InProgress`.
  - Phát sự kiện: `((deduction, rejected), id)` và `((dispute, opened), (id, tenant))`.

### 3.13 `open_dispute`
Chủ nhà hoặc người thuê chủ động mở tranh chấp khi có bất đồng.
```rust
pub fn open_dispute(env: Env, id: BytesN<16>, party: Address) -> Result<(), Error>
```
- Xác thực: `party.require_auth()`.
- Xóa mọi đề xuất khấu trừ và phê duyệt hoàn cọc còn tồn đọng.
- Sự kiện phát: `((dispute, opened), (id, party))`

### 3.14 `resolve_dispute`
Hai bên nộp số tiền thống nhất sau hòa giải. Chỉ giải ngân khi cả hai gửi cùng một số tiền.
```rust
pub fn resolve_dispute(
    env: Env,
    id: BytesN<16>,
    party: Address,
    agreed_amount: i128,
) -> Result<(), Error>
```
- Xác thực: `party.require_auth()`.
- Ràng buộc: `0 <= agreed_amount <= deposit_amount`.
- Nếu số tiền gửi của 2 bên lệch nhau:
  - Reset cả 2 số đã gửi về trạng thái rỗng, giữ tranh chấp ở `InProgress`.
  - Không tự phán xử, không tự giải ngân.
  - Phát sự kiện: `((dispute, amount_mismatch), (id, agreed_amount, other_amount))`.
- Nếu 2 bên khớp cùng số tiền:
  - `deducted = deposit - agreed_amount`.
  - Hợp đồng sang `Ended`, `dispute_status = Resolved`.
  - Phát sự kiện: `((release_authorized,), (id, agreed_amount, deducted))` và `((dispute, resolved), (id, agreed_amount))`.

### 3.15 `get_contract`
Đọc toàn bộ bản ghi hợp đồng.
```rust
pub fn get_contract(env: Env, id: BytesN<16>) -> Result<ContractRecord, Error>
```
- Tự động gia hạn cả persistent TTL và instance TTL.

### 3.16 `get_rent_period`
Đọc bản ghi của một kỳ thuê cụ thể.
```rust
pub fn get_rent_period(env: Env, id: BytesN<16>, period: u32) -> Result<RentPeriodRecord, Error>
```
- `period >= 1`.
- Tự động gia hạn cả persistent TTL và instance TTL.

---

## 4. Bảng mã lỗi (`enum Error`)

Mã lỗi on-chain dạng `u32` khớp hoàn toàn với `contracts/rentflow/src/types.rs`:

| Mã (u32) | Tên biến thể | Ý nghĩa / Ngữ cảnh |
|---|---|---|
| `1` | `AlreadyInitialized` | Hợp đồng đã được khởi tạo trước đó |
| `2` | `NotInitialized` | Contract chưa được thiết lập admin/oracle |
| `3` | `Unauthorized` | Người gọi không có quyền (không phải chủ nhà/người thuê/oracle) |
| `4` | `ContractExists` | Hợp đồng với UUID này đã tồn tại |
| `5` | `ContractNotFound` | Không tìm thấy hợp đồng với UUID yêu cầu |
| `6` | `PeriodNotFound` | Kỳ thuê không hợp lệ (`period < 1`) hoặc chưa được tạo |
| `7` | `InvalidTransition` | Chuyển trạng thái bất hợp pháp (ví dụ: gọi hàm sau khi hợp đồng đã `Ended`) |
| `8` | `InvalidAmount` | Số tiền không hợp lệ (số âm, tiền thuê <= 0, cọc <= 0) |
| `9` | `DepositMismatch` | Số tiền cọc nộp không bằng đúng số tiền cọc theo hợp đồng |
| `10` | `DeductionExceedsDeposit` | Số tiền đề xuất khấu trừ vượt quá tổng tiền cọc |
| `11` | `DeductionNotFound` | Không có đề xuất khấu trừ nào đang chờ phản hồi |
| `12` | `RefundAmountMismatch` | Hai bên gửi số tiền phê duyệt hoàn cọc không khớp nhau |
| `13` | `DisputeActive` | Hành động bị chặn vì hợp đồng đang có tranh chấp chưa giải quyết |
| `14` | `DisputeAmountMismatch` | Hai bên gửi số tiền giải quyết tranh chấp không khớp nhau |
| `15` | `InvalidDueDay` | Ngày đến hạn hàng tháng không nằm trong khoảng 1 đến 31 |
| `16` | `Overflow` | Tràn số nguyên trong các phép tính toán số học |
| `17` | `DuplicatePaymentRef` | Mã tham chiếu thanh toán (`payment_ref_hash`) bị trùng lặp |
| `18` | `SamePartyNotAllowed` | Chủ nhà và người thuê không được là cùng một địa chỉ ví |

---

## 5. Danh mục Sự kiện (Events)

Mỗi thay đổi trạng thái phát ra một event có cấu trúc topics và data rõ ràng:

| Tên sự kiện | Topics | Data | Mục đích |
|---|---|---|---|
| `admin.init` | `("admin", "init")` | `(admin: Address, oracle: Address)` | Ghi nhận contract khởi tạo |
| `contract.created` | `("contract", "created")` | `(id: BytesN<16>, landlord: Address, tenant: Address)` | Hợp đồng mới được tạo |
| `contract.confirmed` | `("contract", "confirmed")` | `(id: BytesN<16>, tenant: Address)` | Người thuê xác nhận |
| `deposit.recorded` | `("deposit", "recorded")` | `(id: BytesN<16>, payment_ref_hash: BytesN<32>, amount: i128)` | Cọc đã nộp đủ |
| `rent.paid` | `("rent", "paid")` | `(id: BytesN<16>, period: u32, amount: i128, payment_ref_hash: BytesN<32>)` | Thanh toán kỳ thuê |
| `rent.overdue` | `("rent", "overdue")` | `(id: BytesN<16>, period: u32, days_late: u32, late_fee: i128)` | Đánh dấu kỳ thuê quá hạn |
| `rent.extended` | `("rent", "extended")` | `(id: BytesN<16>, period: u32, new_due_ts: u64)` | Gia hạn kỳ thuê quá hạn |
| `deposit.refund_requested` | `("deposit", "refund_requested")` | `(id: BytesN<16>, party: Address)` | Yêu cầu hoàn cọc |
| `deposit.refund_approved` | `("deposit", "refund_approved")` | `(id: BytesN<16>, party: Address, refund_amount: i128)` | Một bên duyệt số tiền cọc |
| `deposit.refunded` | `("deposit", "refunded")` | `(id: BytesN<16>, refund_amount: i128)` | Cọc hoàn trả thành công |
| `deduction.proposed` | `("deduction", "proposed")` | `(id: BytesN<16>, amount: i128, reason_hash: BytesN<32>)` | Chủ nhà đề xuất khấu trừ |
| `deduction.accepted` | `("deduction", "accepted")` | `(id: BytesN<16>, amount: i128)` | Người thuê chấp nhận khấu trừ |
| `deduction.rejected` | `("deduction", "rejected")` | `id: BytesN<16>` | Người thuê từ chối khấu trừ |
| `dispute.opened` | `("dispute", "opened")` | `(id: BytesN<16>, party: Address)` | Tranh chấp được mở |
| `dispute.awaiting_confirmation` | `("dispute", "awaiting_confirmation")` | `(id: BytesN<16>, party: Address, agreed_amount: i128)` | Một bên nộp số tiền thống nhất |
| `dispute.amount_mismatch` | `("dispute", "amount_mismatch")` | `(id: BytesN<16>, agreed_amount: i128, other_amount: i128)` | Hai bên gửi lệch tiền |
| `dispute.resolved` | `("dispute", "resolved")` | `(id: BytesN<16>, agreed_amount: i128)` | Tranh chấp đã hòa giải xong |
| **`release_authorized`** | `("release_authorized",)` | `(id: BytesN<16>, refund_amount: i128, deducted_amount: i128)` | **Cấp quyền giải ngân mô phỏng. BẢO ĐẢM PHÁT TỐI ĐA 1 LẦN DUY NHẤT** |

---

## 6. Kiểu dữ liệu & Bản ghi (Data Records)

### `ContractRecord`
```rust
#[contracttype]
pub struct ContractRecord {
    pub id: BytesN<16>,
    pub landlord: Address,
    pub tenant: Address,
    pub doc_hash: BytesN<32>,
    pub deposit_amount: i128,
    pub rent_amount: i128,
    pub due_day: u32,
    pub late_fee_bps_per_day: u32,
    pub status: ContractStatus,
    pub deposit_status: DepositStatus,
    pub dispute_status: DisputeStatus,
    pub deposit_paid_amount: i128,
    pub refund_amount: i128,
    pub deducted_amount: i128,
}
```

### `RentPeriodRecord`
```rust
#[contracttype]
pub struct RentPeriodRecord {
    pub contract_id: BytesN<16>,
    pub period_no: u32,
    pub amount_due: i128,
    pub amount_paid: i128,
    pub late_days: u32,
    pub late_fee: i128,
    pub status: RentStatus,
    pub due_date_ts: u64,
}
```

### `DeductionProposal`
```rust
#[contracttype]
pub struct DeductionProposal {
    pub amount: i128,
    pub reason_hash: BytesN<32>,
}
```

### `DataKey`
```rust
#[contracttype]
pub enum DataKey {
    Admin,
    Oracle,
    Contract(BytesN<16>),
    RentPeriod(BytesN<16>, u32),
    RefundApproval(BytesN<16>, Address),
    DeductionProposal(BytesN<16>),
    DisputeAgreed(BytesN<16>, Address),
    PaymentRef(BytesN<16>, BytesN<32>),
}
```

---

## 7. Cơ chế Quản lý Vòng đời & Gia hạn TTL (Storage Lifetime)

Trên mạng Stellar Soroban, dữ liệu state cần được gia hạn để không bị lưu trữ lưu kho (archived).
RentFlow thiết lập các thông số TTL bảo đảm dữ liệu demo **không bao giờ hết hạn trước ngày thi và thời gian chấm thi**:

- **Thời gian một ngày theo Ledger**: `const DAY_IN_LEDGERS: u32 = 17280;` (~5 giây/ledger × 17,280 = 86,400 giây = 24 giờ).
- **Ngưỡng kiểm tra (Threshold)**: `14 * DAY_IN_LEDGERS` (14 ngày = 241,920 ledgers).
- **Mức gia hạn (Bump Amount)**: `60 * DAY_IN_LEDGERS` (60 ngày = 1,036,800 ledgers).

### Nguyên tắc gia hạn tự động:
1. **Mọi thao tác ghi**: Gia hạn cả persistent entry và instance contract lên ít nhất 60 ngày nếu TTL còn dưới 14 ngày.
2. **Mọi thao tác đọc (Query/View)**: Các hàm `get_contract`, `get_rent_period`, `calc_late_fee` tự động gọi `extend_persistent_ttl` và `extend_instance_ttl`. Nhờ vậy, chỉ cần ban giám khảo hoặc UI mở xem hợp đồng, dữ liệu tự động được duy trì thêm 60 ngày.
3. Không vượt quá giới hạn an toàn `max_entry_ttl` của Stellar Testnet/Mainnet (~180 ngày).
