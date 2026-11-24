# Kiến trúc Hệ thống RentFlow

Tài liệu kiến trúc kỹ thuật của hệ thống **RentFlow** — Dịch vụ bảo chứng tiền cọc và thu tiền thuê nhà tự động, kết hợp Track 4 (Ví chuyên biệt, Custody) và Track 5 (Soroban Smart Contract) trên nền tảng Stellar Testnet.

---

## 1. Kiến trúc tổng thể hệ thống

Hệ thống kết hợp giữa kiến trúc ứng dụng Web hiện đại (Next.js 16, Supabase) và sổ cái phân tán Stellar Soroban, trong đó luồng thanh toán và ngân hàng nội địa được mô phỏng có nhãn minh bạch.

```mermaid
flowchart TD
    subgraph Client["Trình duyệt Người dùng (Client Tier)"]
        UI["Next.js 16 UI (React 19, Tailwind CSS 4)"]
        PasskeyClient["WebAuthn / Passkey API (Trình duyệt)"]
    end

    subgraph Backend["Hệ thống Máy chủ (Backend Tier - Next.js Route Handlers)"]
        API["API Route Handlers (/api/*)"]
        AuthModule["Module Xác thực (OTP, Phiên Cookie ký)"]
        StepUpModule["Bảo mật Bước hai (Passkey, OTP Challenge)"]
        DomainService["Domain Services (Hợp đồng, Cọc, Tiền thuê, Tranh chấp)"]
        Settlement["Bộ quyết toán (Settlement Engine)"]
        OutboxQueue["Hàng đợi Outbox (Transactional Outbox)"]
        CustodyModule["Quản lý Ví Custody (AES-256-GCM)"]
        RpcClient["Soroban RPC Client & Fee-Bump Wrapper"]
    end

    subgraph Storage["Cơ sở dữ liệu & Lưu trữ (Supabase Tier)"]
        Postgres[("PostgreSQL 15 Local")]
        RLS["Hàng rào Phân quyền RLS (Row Level Security)"]
        OutboxTable["Bảng onchain_txs (Outbox Pattern)"]
        CustodyTable["Bảng custody_wallets (Khóa AES-256-GCM)"]
    end

    subgraph Blockchain["Mạng lưới Stellar Blockchain (Track 4 & 5)"]
        SorobanRPC["Stellar Soroban RPC (Testnet)"]
        SmartContract["Soroban Smart Contract (Rust Wasm)"]
        Ledger[("Stellar Ledger (Sổ cái phân tán)")]
    end

    subgraph Simulation["Cổng Thanh toán & Ngân hàng (Mô phỏng)"]
        VietQR["VietQR mô phỏng (Tạo mã QR thanh toán)"]
        MockBank["Tài khoản Escrow mô phỏng (Chuyển tiền giả lập)"]
        PayOSGateway["payOS Adapter (Cổng thanh toán demo)"]
    end

    UI -->|"Gửi yêu cầu API + Cookie"| API
    PasskeyClient -->|"Ký xác thực WebAuthn"| StepUpModule
    API --> DomainService
    API --> AuthModule
    DomainService --> Settlement
    DomainService --> OutboxQueue
    StepUpModule --> Postgres
    DomainService -->|"Ghi dữ liệu nghiệp vụ"| Postgres
    OutboxQueue -->|"Lưu giao dịch PENDING"| OutboxTable
    Settlement -->|"Cập nhật thanh toán"| Postgres
    CustodyModule -->|"Lưu/Đọc khóa mã hóa"| CustodyTable

    OutboxQueue -->|"Xử lý hàng đợi (flushOnchain)"| RpcClient
    CustodyModule -->|"Giải mã khóa tạm thời ký Auth"| RpcClient
    RpcClient -->|"Gửi Transaction / Fee-Bump"| SorobanRPC
    SorobanRPC -->|"Thực thi & Phát Event"| SmartContract
    SmartContract -->|"Cập nhật trạng thái"| Ledger

    DomainService -.->|"Tạo mã thanh toán"| VietQR
    VietQR -.->|"Hiển thị QR nạp cọc"| UI
    PayOSGateway -.->|"Webhook mô phỏng tiền về"| API
    DomainService -.->|"Mô phỏng lệnh giải ngân"| MockBank

    classDef real fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef mock fill:#fff3e0,stroke:#f57c00,stroke-width:2px,stroke-dasharray: 5 5;
    class UI,PasskeyClient,API,AuthModule,StepUpModule,DomainService,Settlement,OutboxQueue,CustodyModule,RpcClient,Postgres,RLS,OutboxTable,CustodyTable,SorobanRPC,SmartContract,Ledger real;
    class VietQR,MockBank,PayOSGateway mock;
```

> [!NOTE]
> **Hiện trạng triển khai thực tế so với mô phỏng:**
> - **Chạy thật 100%:** Smart contract Soroban trên Stellar Testnet (WASM Rust 29.0.1); hàng đợi Outbox tự động thử lại; ví custody mã hóa AES-256-GCM; ký xác thực WebAuthn (Passkey) trên thiết bị ảo; cơ sở dữ liệu Supabase kèm chính sách RLS chặt chẽ; Fee-Bump transaction (CAP-15) do nền tảng tài trợ phí.
> - **Mô phỏng (Mock):** Ngân hàng, mã VietQR, xác nhận tiền về, tài khoản ký quỹ escrow ngân hàng và lệnh giải ngân VND hoàn toàn là **mô phỏng**. OTP đăng nhập cố định mã `123456` cho tài khoản demo (chưa đấu nối SMS gateway thực tế). payOS có mã adapter nhưng chạy ở chế độ mô phỏng (`PAYMENT_MODE=simulated`).

---

## 2. Bảng phân bổ dữ liệu: Off-chain vs On-chain

Hệ thống tuân thủ nguyên tắc đạo đức cốt lõi của Blockchain: **Tuyệt đối không đưa dữ liệu nhận dạng cá nhân (PII) lên sổ cái công khai**.

| Dữ liệu | Vị trí lưu trữ | Cơ chế bảo vệ / Định dạng | Lý do thiết kế |
|---|---|---|---|
| **Họ tên, SĐT, Email** | Off-chain (Supabase) | Bảng `profiles`, mã hóa đường truyền TLS, phân quyền RLS theo `auth.uid()`. | Tránh vi phạm quyền riêng tư vĩnh viễn trên sổ cái phi tập trung; tuân thủ quy chuẩn bảo vệ dữ liệu. |
| **Văn bản hợp đồng & Điều khoản** | Off-chain (Supabase) | Bảng `rental_contracts.terms_text`, `room_label`. | Văn bản chứa địa chỉ phòng, số nhà, thông tin cá nhân; dung lượng lớn gây tốn phí lưu trữ ledger. |
| **Mã băm hợp đồng (`doc_hash`)** | **Cả hai** (DB & On-chain) | Chuẩn hóa Canonical JSON, SHA-256 có muối ngẫu nhiên 32 byte (`doc_salt`). Lưu dạng `BytesN<32>`. | Bằng chứng bảo chứng toàn vẹn (immutability). Hai bên có thể tự kiểm chứng mà không lộ nội dung hợp đồng ra bên thứ ba. |
| **Muối của hợp đồng (`doc_salt`)** | Off-chain (Supabase) | 32 byte hex ngẫu nhiên (`rental_contracts.doc_salt`). Chỉ chủ nhà và người thuê được đọc. | Ngăn chặn tấn công dò ngược (rainbow table / brute-force) đối với các hợp đồng có nội dung ngắn hoặc theo mẫu chung. |
| **Số tiền cọc & Tiền thuê** | **Cả hai** (DB & On-chain) | DB: `bigint` (VND); On-chain: `i128`. | Smart Contract cần số tiền số nguyên để thực thi điều kiện logic (khấu trừ không vượt quá cọc, đối soát hoàn cọc, tính phí trễ). |
| **Ngày thanh toán & Phí trễ** | **Cả hai** (DB & On-chain) | DB: `due_day`, `late_fee_bps_per_day`; On-chain: `u32`. | Thực thi tính toán phí trễ minh bạch (`calc_late_fee`) và tự động hóa quy tắc gia hạn (`extend_due`). |
| **Mã tham chiếu thanh toán** | Off-chain (Supabase) | DB: `payments.order_code` (số nguyên duy nhất từ cổng thanh toán). | Tránh lộ mã định danh ngân hàng nội địa lên sổ cái quốc tế. |
| **Mã băm thanh toán (`payment_ref_hash`)** | **Cả hai** (DB & On-chain) | SHA-256(salt \|\| `provider:order_code`), lưu dạng `BytesN<32>`. | Smart Contract ghi nhận tiền cọc/tiền thuê (`record_deposit_paid`, `record_rent_paid`) và chặn gửi trùng (replay attack). |
| **Lý do khấu trừ dạng chữ** | Off-chain (Supabase) | Bảng `deduction_requests.reason_text`. | Lý do có thể chứa thông tin nhạy cảm giữa hai bên (hỏng hóc, sự cố cá nhân). |
| **Mã băm lý do (`reason_hash`)** | **Cả hai** (DB & On-chain) | SHA-256(salt \|\| `reason_text_NFC_LF`), lưu dạng `BytesN<32>`. | Minh chứng ràng buộc landlord không thể tự ý thay đổi lý do sau khi đã đề xuất khấu trừ cọc. |
| **Trạng thái HĐ, Cọc, Kỳ thuê, Tranh chấp** | **Cả hai** (DB & On-chain) | Enum u32 ánh xạ 1-1 với TypeScript (`states.ts` và `types.rs`). | Đồng bộ trạng thái thực thi: Smart contract là nguồn sự thật tối thượng cho tranh chấp và giải ngân. |
| **Khóa bí mật ví người dùng** | Off-chain (Supabase) | Mã hóa đối xứng AES-256-GCM với `CUSTODY_MASTER_KEY`, IV 12 bytes, Tag 16 bytes. | Giữ hộ ví cho người dùng không rành Web3, nhưng tuyệt đối không lộ lên mạng hay client. |
| **Địa chỉ công khai Stellar (`Address`)** | **Cả hai** (DB & On-chain) | Dạng chuỗi Base32 `G...` (Stellar Public Key). | Định danh thực thể ký duyệt trong Soroban Auth Entry. |

---

## 3. Sơ đồ tuần tự nạp cọc: Quét VietQR mô phỏng đến xác nhận Testnet

Quy trình nạp cọc mô phỏng bảo đảm tính nhất quán giữa trạng thái thanh toán off-chain và sự kiện ghi nhận trên sổ cái Stellar.

```mermaid
sequenceDiagram
    autonumber
    actor Tenant as Người thuê
    participant UI as Giao diện RentFlow (Next.js)
    participant API as Backend Route (/api/*)
    participant DB as Supabase PostgreSQL
    participant Outbox as Hàng đợi Outbox (onchain_txs)
    participant Custody as Ví Custody (AES-256-GCM)
    participant Worker as Background Flush Worker
    participant Soroban as Soroban RPC (Testnet)
    participant Contract as Smart Contract (CCDNF...)

    Tenant->>UI: Bấm "Nạp tiền cọc" tại hợp đồng
    UI->>API: POST /api/contracts/[id]/deposit/pay
    API->>DB: Kiểm tra trạng thái HĐ (ACTIVE) & Cọc (UNPAID)
    API->>DB: Tạo bản ghi payments (KIND=DEPOSIT, status=PENDING, VietQR mô phỏng)
    API-->>UI: Trả về thông tin QR & URL thanh toán mô phỏng

    Tenant->>UI: Quét mã QR & Bấm "Xác nhận nạp thành công (Mô phỏng)"
    UI->>API: POST /api/payments/[id]/simulate-confirm
    API->>DB: Kiểm tra idempotent qua payment_events
    API->>DB: Cập nhật payments -> CONFIRMED

    Note over API,DB: Gọi Bộ quyết toán (Settlement Engine)
    API->>DB: Chuyển deposits.status -> RECORDED
    API->>DB: Sinh muối payment_ref_salt (32 bytes)
    API->>DB: Tính payment_ref_hash = SHA-256(salt || "SIMULATED:orderCode")

    API->>Outbox: enqueueOnchain(action="record_deposit_paid", signer=ORACLE)
    Outbox->>DB: INSERT INTO onchain_txs (status=PENDING, payload_hash, args)
    API-->>UI: Trả về { success: true, status: "RECORDED" } (Phản hồi tức thì)

    Note over Worker,Soroban: Tiến trình nền xử lý hàng đợi (Background Flush)
    Worker->>DB: Lấy onchain_txs PENDING theo thứ tự hàng đợi
    Worker->>DB: UPDATE onchain_txs -> SUBMITTED
    Worker->>Custody: Lấy khóa ký Oracle (STELLAR_ORACLE_SECRET)
    Worker->>Soroban: buildAndSimulate (Gọi hàm record_deposit_paid)
    Soroban-->>Worker: Trả về Footprint tài nguyên & Auth requirements
    Worker->>Custody: Ký ủy quyền Soroban Auth Entry (Oracle Signature)
    Worker->>Worker: Đóng gói Fee-Bump Transaction (Platform trả phí gas)
    Worker->>Soroban: sendTransaction(FeeBumpTransaction)
    Soroban->>Contract: Thực thi record_deposit_paid
    Contract->>Contract: Kiểm tra amount == deposit_amount, lưu PaymentRef
    Contract-->>Soroban: Chuyển DepositStatus -> Recorded, phát Event deposit_recorded
    Worker->>Soroban: Polling getTransaction(txHash) cho đến khi SUCCESS
    Worker->>DB: UPDATE onchain_txs -> CONFIRMED (tx_hash, confirmed_at)
    UI->>API: Polling trạng thái on-chain
    API-->>UI: Trả về trạng thái CONFIRMED kèm link Stellar.Expert
```

---

## 4. Máy trạng thái (State Machines)

Toàn bộ hệ thống được kiểm soát bởi 4 máy trạng thái chính. Thứ tự các trạng thái được ánh xạ chính xác giữa `src/domain/states.ts` và `contracts/rentflow/src/types.rs`.

### 4.1 Hợp đồng (`ContractStatus`)
- `0`: `PENDING_CONFIRMATION` (Chờ xác nhận)
- `1`: `ACTIVE` (Đang hiệu lực)
- `2`: `ENDED` (Đã kết thúc)
- `3`: `CANCELLED` (Đã hủy)

```mermaid
stateDiagram-v2
    [*] --> PENDING_CONFIRMATION: create_contract (Chủ nhà tạo)
    PENDING_CONFIRMATION --> ACTIVE: tenant_confirm (Người thuê ký xác nhận)
    PENDING_CONFIRMATION --> CANCELLED: Hủy trước khi người thuê ký
    ACTIVE --> ENDED: approve_refund / respond_deduction / resolve_dispute (Quyết toán cọc)
    ENDED --> [*]
    CANCELLED --> [*]
```

### 4.2 Tiền cọc (`DepositStatus`)
- `0`: `UNPAID` (Chưa thanh toán)
- `1`: `RECORDED` (Đã ghi nhận trên chain)
- `2`: `PENDING_REFUND` (Chờ hoàn cọc)
- `3`: `PENDING_DISPUTE` (Chờ xử lý tranh chấp)
- `4`: `REFUNDED` (Đã hoàn trả đủ tiền)
- `5`: `DEDUCTED` (Đã khấu trừ theo thỏa thuận)

```mermaid
stateDiagram-v2
    [*] --> UNPAID: Khởi tạo hợp đồng
    UNPAID --> RECORDED: record_deposit_paid (Oracle xác nhận nạp đủ cọc)
    RECORDED --> PENDING_REFUND: request_refund / propose_deduction (Yêu cầu nghiệm thu)
    RECORDED --> PENDING_DISPUTE: open_dispute (Mở tranh chấp trực tiếp)
    PENDING_REFUND --> REFUNDED: approve_refund (Hai bên đồng thuận trả 100%)
    PENDING_REFUND --> DEDUCTED: respond_deduction(accept=true) / approve_refund(khớp số tiền khấu trừ)
    PENDING_REFUND --> PENDING_DISPUTE: respond_deduction(accept=false) / open_dispute
    PENDING_DISPUTE --> REFUNDED: resolve_dispute (Hai bên thống nhất số tiền = cọc)
    PENDING_DISPUTE --> DEDUCTED: resolve_dispute (Hai bên thống nhất số tiền < cọc)
    REFUNDED --> [*]
    DEDUCTED --> [*]
```

### 4.3 Kỳ thanh toán tiền thuê (`RentStatus`)
- `0`: `NOT_DUE` (Chưa đến hạn)
- `1`: `AWAITING_PAYMENT` (Chờ thanh toán)
- `2`: `PAID` (Đã thanh toán đủ)
- `3`: `OVERDUE` (Quá hạn)
- `4`: `PARTIALLY_PAID` (Thanh toán một phần)

```mermaid
stateDiagram-v2
    [*] --> NOT_DUE: Tự động tạo 12 kỳ khi HĐ Active
    NOT_DUE --> AWAITING_PAYMENT: Đến chu kỳ thanh toán
    AWAITING_PAYMENT --> PAID: record_rent_paid (Thanh toán đủ hoặc thừa)
    AWAITING_PAYMENT --> PARTIALLY_PAID: record_rent_paid (Thanh toán thiếu)
    AWAITING_PAYMENT --> OVERDUE: mark_overdue (Hết hạn chưa trả)
    PARTIALLY_PAID --> PAID: record_rent_paid (Trả nốt phần thiếu)
    PARTIALLY_PAID --> OVERDUE: mark_overdue (Hết hạn vẫn còn thiếu)
    OVERDUE --> AWAITING_PAYMENT: extend_due (Chủ nhà gia hạn)
    OVERDUE --> PARTIALLY_PAID: record_rent_paid (Trả một phần phí trễ/tiền thuê)
    OVERDUE --> PAID: record_rent_paid (Trả đủ tiền thuê + phí trễ)
    PAID --> [*]
```

### 4.4 Tranh chấp (`DisputeStatus`)
- `0`: `NONE` (Không có tranh chấp)
- `1`: `AWAITING_CONFIRMATION` (Đang chờ đối phương xác nhận số tiền)
- `2`: `IN_PROGRESS` (Đang hòa giải thương lượng)
- `3`: `RESOLVED` (Đã thống nhất kết quả giải quyết)

```mermaid
stateDiagram-v2
    [*] --> NONE: Trạng thái ban đầu
    NONE --> IN_PROGRESS: open_dispute / respond_deduction(reject)
    IN_PROGRESS --> AWAITING_CONFIRMATION: resolve_dispute (Một bên đề xuất số tiền hòa giải)
    AWAITING_CONFIRMATION --> RESOLVED: resolve_dispute (Bên kia đồng thuận cùng số tiền)
    AWAITING_CONFIRMATION --> IN_PROGRESS: resolve_dispute (Bên kia gửi số tiền khác -> lệch -> quay lại đàm phán)
    RESOLVED --> [*]: Phát sự kiện release_authorized giải phóng cọc
```

---

## 5. Mô hình Custody (Ví chuyên biệt) & Bảo mật

RentFlow lựa chọn mô hình **Ví lưu ký chuyên biệt do Server quản lý (Server-Managed Custody)** kết hợp cơ chế ủy quyền đa yếu tố WebAuthn/Passkey để cân bằng giữa trải nghiệm người dùng thông thường và tính an toàn của tài sản số.

```mermaid
flowchart TD
    subgraph UserAction["Thao tác Người dùng"]
        Action["Ký hợp đồng / Duyệt hoàn cọc / Chấp nhận khấu trừ"]
        PasskeyAuth["Xác thực Sinh trắc học (Passkey / WebAuthn)"]
    end

    subgraph StepUpSecurity["Lớp Bảo mật Bước hai (Step-Up Guard)"]
        ChallengeGen["Tạo Challenge ngẫu nhiên (32 byte hex)"]
        ChallengeTable[("auth_challenges (TTL 10 phút)")]
        ChallengeVerify["Kiểm tra & Hủy Token ngay lập tức (Single-use)"]
    end

    subgraph CustodyLayer["Lớp Quản lý Khóa Ví (Custody Engine)"]
        MasterKey["CUSTODY_MASTER_KEY (Biến môi trường / KMS)"]
        EncryptedDB[("custody_wallets.encrypted_secret")]
        AESDecryption["Giải mã AES-256-GCM trong Bộ nhớ (RAM)"]
        KeypairMem["Stellar Keypair (Không bao giờ log ra đĩa)"]
        GC["Thu hồi bộ nhớ tự động (Garbage Collection)"]
    end

    subgraph SorobanAuth["Lớp Giao dịch Blockchain (Soroban & CAP-15)"]
        Simulate["Simulate Transaction qua RPC"]
        AuthEntry["Tạo Soroban Authorization Entry"]
        SignEntry["Ký Auth Entry bằng Khóa Custody của User"]
        FeeBump["Bọc FeeBumpTransaction (Platform trả phí XLM)"]
        StellarNetwork["Gửi lên Stellar Testnet"]
    end

    Action --> PasskeyAuth
    PasskeyAuth --> ChallengeGen
    ChallengeGen --> ChallengeTable
    ChallengeTable --> ChallengeVerify
    ChallengeVerify -->|"Xác thực đạt"| AESDecryption

    MasterKey --> AESDecryption
    EncryptedDB --> AESDecryption
    AESDecryption --> KeypairMem
    KeypairMem --> SignEntry
    KeypairMem -.-> GC

    Simulate --> AuthEntry
    AuthEntry --> SignEntry
    SignEntry --> FeeBump
    FeeBump --> StellarNetwork
```

### 5.1 Quy chuẩn mã hóa AES-256-GCM
- **Khóa chủ (`CUSTODY_MASTER_KEY`):** Khóa đối xứng 256-bit (32 bytes base64). Trong bản phát triển/demo được đọc từ `.env.local`; trong môi trường Production cần được bảo vệ bởi AWS KMS, Google Cloud KMS hoặc thiết bị HSM phần cứng.
- **IV (Initialization Vector):** 12 bytes ngẫu nhiên được sinh mới cho mỗi thao tác tạo ví qua `crypto.randomBytes(12)`.
- **Auth Tag:** 16 bytes authentication tag bảo vệ tính toàn vẹn (Authenticated Encryption), chống việc sửa đổi bản mã.
- **Định dạng lưu trữ:** Chuỗi chuẩn hóa `ivHex:tagHex:dataHex` trong cột `custody_wallets.encrypted_secret`.
- **Cơ chế thu hồi:** Quá trình giải mã khóa bí mật diễn ra tạm thời bên trong callback `withCustodyKeypair`, trả về kết quả và giải phóng tham chiếu khóa khỏi bộ nhớ RAM ngay sau khi ký xong.

### 5.2 Cơ chế Bước hai (Step-Up Authentication)
Để ngăn chặn các hành vi xâm nhập hoặc tấn công CSRF kích hoạt ví custody, mọi thao tác thay đổi trạng thái tài chính bắt buộc phải vượt qua bước hai:
1. **Các hành động bắt buộc:** `SIGN_CONTRACT`, `APPROVE_REFUND`, `RESPOND_DEDUCTION`, `RESOLVE_DISPUTE`, `EXTEND_DUE`.
2. **Quy trình Token dùng một lần:** Server tạo token 32 bytes ngẫu nhiên trong bảng `auth_challenges` có thời hạn tối đa 10 phút (`type=STEP_UP`).
3. **Chống Replay Attack:** Ngay khi hàm `requireStepUp` kiểm tra token thành công, bản ghi trong `auth_challenges` lập tức bị **DELETE**, bảo đảm không thể dùng lại một token cho lần thứ hai.
4. **Bypass chế độ demo:** Trong môi trường thử nghiệm với `DEMO_MODE=true`, hệ thống chấp nhận token `demo-step-up` để phục vụ các kịch bản kiểm thử tự động (e2e scripts). Cờ này bắt buộc phải tắt ở môi trường thật.

### 5.3 Cơ chế Tài trợ phí Gas (CAP-15 Fee-Bump Transaction)
- **Vấn đề:** Người dùng thông thường không có sẵn đồng XLM trên ví để trả phí giao dịch blockchain Soroban.
- **Giải pháp:** Hệ thống sử dụng cơ chế Fee-Bump (CAP-15) của giao thức Stellar:
  1. Người dùng chỉ cần ký **Soroban Authorization Entry** để xác nhận quyền hạn pháp lý/nghiệp vụ của mình đối với hợp đồng thông minh.
  2. Giao dịch gốc (`innerTx`) được bọc trong một `FeeBumpTransaction` với tài khoản nền tảng (`STELLAR_PLATFORM_SECRET`) đóng vai trò là Fee Source Account.
  3. Mạng Stellar khấu trừ phí giao dịch từ tài khoản nền tảng, hoàn toàn giải phóng người thuê và chủ nhà khỏi việc phải mua hay nắm giữ tiền điện tử.
