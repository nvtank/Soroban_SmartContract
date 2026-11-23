# Handoff giữa các agent

Cần sửa file ngoài phạm vi của mình thì ghi yêu cầu ở đây, không tự sửa.

Mẫu: `[Ngày] [Agent gửi → Agent nhận] File/khu vực — Nội dung — Trạng thái (MỞ/XONG)`

## Phạm vi sở hữu

| Agent | Nhánh | File |
|---|---|---|
| A | `feat/agent-a-contract` | `contracts/**`, `scripts/deploy-contract.sh` |
| B | `feat/agent-b-db-auth` | `supabase/**`, `src/lib/supabase/**`, `src/app/api/auth/**`, `src/lib/crypto/**` |
| C | `feat/agent-c-domain` | `src/domain/**` (trừ `payments`), `src/app/api/contracts/**`, `src/app/api/deductions/**`, `src/app/api/jobs/**` |
| D | `feat/agent-d-stellar` | `src/lib/stellar/**`, `src/app/api/onchain/**` |
| E | `feat/agent-e-payments` | `src/lib/payos/**`, `src/app/api/payments/**`, `src/domain/payments/**` |
| F | `feat/agent-f-ui-landing` | `src/app/(marketing)/**`, `src/components/{layout,motion,marketing}/**`, `src/styles/**` |
| G | `feat/agent-g-app-ui` | `src/app/(app)/**`, `src/components/app/**` |
| H | `feat/agent-h-qa` | `tests/**`, `docs/DEMO_SCRIPT.md`, `docs/TEST_REPORT.md`, `README.md` |

Manager giữ: `src/domain/states.ts`, `contracts/rentflow/src/types.rs`, `docs/CONTRACTS.md`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`.

## Điểm chồng lấn đã phân xử

- `/api/contracts/[id]/deposit/pay` và `/rent/[period]/pay` nằm trong thư mục của C nhưng do **E** viết. C không tạo hai route này.
- `/api/contracts/[id]/onchain` nằm trong thư mục của C nhưng do **D** viết. C không tạo route này.
- `/api/jobs/flush-onchain` do **D** viết. `/api/jobs/overdue-scan` do **C** viết.
- `src/app/page.tsx` là trang tạm. **F** xóa nó khi tạo `src/app/(marketing)/page.tsx`.
- `/bang-chung` do **G** làm, `/minh-bach` do **F** làm.

## Yêu cầu đang mở

_Chưa có._
