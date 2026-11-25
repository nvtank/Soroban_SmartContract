# Bảng điều khiển quản trị: nguyên tắc và API

Kiểu dữ liệu: `src/domain/admin/dto.ts`. Bộ gọi API phía giao diện: `src/lib/admin/api-client.ts`.

## Nguyên tắc (bắt buộc)

1. **Admin chỉ xem và vận hành.** Không phân xử tranh chấp, không giải ngân, không sửa số tiền hay trạng thái nghiệp vụ, không đăng nhập thay người dùng. Tranh chấp chỉ giải quyết khi hai bên cùng gửi một số tiền (đã có trong nghiệp vụ).
2. **Hành động được phép** (mỗi lần làm đều ghi `audit_logs` với `action = ADMIN_*`):
   - thử lại giao dịch on-chain bị lỗi;
   - duyệt yêu cầu khôi phục tài khoản (luồng đã có);
   - chạy tay quét quá hạn và đẩy hàng đợi on-chain (job đã có);
   - khởi tạo lại dữ liệu demo (chỉ khi `DEMO_MODE=true`).
3. **Tối thiểu dữ liệu cá nhân.** Số điện thoại luôn che bớt (`090***0002`). Không hiển thị CCCD. Tên hiển thị có thể rút gọn. Không bao giờ trả khóa bí mật ví hay `SESSION_SECRET`. Trên chain vốn không có dữ liệu cá nhân.
4. **Tiền là mô phỏng.** Mọi số tiền gắn nhãn "mô phỏng"; contract không giữ VND.
5. **Không dùng AI** để chấm điểm hay kết luận về người dùng.
6. **Bảo vệ:** mọi `/api/admin/**` yêu cầu phiên `ADMIN_DEMO` (cookie ký của RentFlow), sai thì 401 (chưa đăng nhập) hoặc 403 (không phải admin). Trang `/admin/**` (trừ `/admin/dang-nhap`) chuyển hướng về `/admin/dang-nhap` nếu không phải admin.
7. **Trực tiếp** bằng cách hỏi lại mỗi 5 giây (polling), dừng khi tab bị ẩn. Không dùng WebSocket.

## Đăng nhập admin

Trang `/admin/dang-nhap` dùng tài khoản `admin` và mật khẩu khi bật `DEMO_MODE` và cấu hình `DEMO_ADMIN_PASSWORD_HASH`. `POST /api/auth/admin/password` xác thực ở máy chủ và cấp phiên cho hồ sơ `ADMIN_DEMO` có số `0900000004`. Khi không cấu hình hash, trang dùng số `0900000004` và mã OTP bí mật `DEMO_ADMIN_OTP` qua `/api/auth/otp/verify`.

## Các trang

| Đường dẫn | Nội dung |
|---|---|
| `/admin` | Tổng quan: thẻ KPI và biểu đồ 30 ngày |
| `/admin/truc-tiep` | Trực tiếp: người dùng đang hoạt động, sự kiện theo phút, dòng sự kiện |
| `/admin/nguoi-dung`, `/admin/nguoi-dung/[id]` | Người dùng |
| `/admin/hop-dong`, `/admin/hop-dong/[id]` | Hợp đồng |
| `/admin/thanh-toan` | Thanh toán (mô phỏng) |
| `/admin/on-chain` | Hàng đợi giao dịch Stellar, thử lại |
| `/admin/nhat-ky` | Nhật ký kiểm toán |
| `/admin/khoi-phuc` | Duyệt khôi phục tài khoản |
| `/admin/he-thong` | Tình trạng hệ thống, tác vụ nền |

## API

Tất cả `GET` trả `{ data: T }` theo `ok()` của `src/lib/api/http.ts`.

| Method | Đường dẫn | Trả về |
|---|---|---|
| GET | `/api/admin/overview` | `AdminOverviewDto` |
| GET | `/api/admin/live?since=<iso>` | `AdminLiveDto` |
| GET | `/api/admin/users?page&pageSize&q&role&sort` | `Page<AdminUserRow>` |
| GET | `/api/admin/users/[id]` | `AdminUserDetailDto` |
| GET | `/api/admin/contracts?page&pageSize&q&status&sort` | `Page<AdminContractRow>` |
| GET | `/api/admin/contracts/[id]` | `AdminContractDetailDto` |
| GET | `/api/admin/payments?page&pageSize&q&status` | `Page<AdminPaymentRow>` |
| GET | `/api/admin/onchain?page&pageSize&status` | `Page<AdminOnchainRow>` |
| POST | `/api/admin/onchain/[id]/retry` | `AdminOnchainRow` (chỉ khi FAILED) |
| GET | `/api/admin/audit?page&pageSize&q&action` | `Page<AdminAuditRow>` |
| GET | `/api/admin/recovery` | `AdminRecoveryRow[]` |
| POST | `/api/admin/recovery/[id]/approve` | `{ ok: true }` (gọi luồng duyệt đã có) |
| GET | `/api/admin/health` | `AdminHealthDto` |
| POST | `/api/admin/jobs/overdue-scan` | kết quả job (gọi job đã có) |
| POST | `/api/admin/jobs/flush-onchain` | kết quả job (gọi job đã có) |

## Theo dõi hoạt động người dùng

- Đăng nhập (OTP, Passkey) và đăng xuất ghi `audit_logs` (`action = LOGIN | LOGOUT`).
- Mọi thao tác nghiệp vụ đã ghi `audit_logs`; API chuyển chúng thành `AdminEvent`.
- `profiles.last_active_at` cập nhật khi người dùng gọi API, gộp tối đa 1 lần mỗi phút để không ghi quá nhiều.
