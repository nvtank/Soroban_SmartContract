"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { AdminContractRow, AdminUserDetailDto } from "@/domain/admin/dto";
import { adminApi, formatVnd } from "@/lib/admin/api-client";
import { AdminStatusPill, DataTable, type ColumnDef } from "@/components/admin/table";
import { AdminPageHeader } from "@/components/admin/shell/AdminPageHeader";
import { ActivityBarChart } from "./ActivityBarChart";
import { DetailSkeleton } from "./DetailSkeleton";
import { EventTimeline } from "./EventTimeline";
import { WalletAddressPill } from "./WalletAddressPill";
import { formatDate, formatDateTime, formatRelativeTime, maskPhoneSafety } from "./formatters";

export function UserDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${id}|${retryTick}`;
  const [state, setState] = useState<{
    key: string;
    user: AdminUserDetailDto | null;
    error: string | null;
  }>({ key: "", user: null, error: null });

  const load = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .user(id)
      .then((res) => {
        if (active) setState({ key: requestKey, user: res, error: null });
      })
      .catch((err) => {
        if (active) {
          setState({
            key: requestKey,
            user: null,
            error: err instanceof Error ? err.message : "Không thể tải hồ sơ người dùng.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [id, requestKey]);

  const loading = state.key !== requestKey;
  const user = loading ? null : state.user;
  const error = loading ? null : state.error;

  const contractColumns = useMemo<ColumnDef<AdminContractRow>[]>(
    () => [
      {
        key: "roomLabel",
        header: "Phòng",
        isMobileTitle: true,
        cell: (row) => (
          <Link
            href={`/admin/hop-dong/${row.id}`}
            className="font-bold text-ink transition-colors hover:text-primary-strong hover:underline"
          >
            {row.roomLabel}
          </Link>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        cell: (row) => <AdminStatusPill kind="contract" status={row.status} />,
      },
      {
        key: "depositStatus",
        header: "Tiền cọc",
        cell: (row) => <AdminStatusPill kind="deposit" status={row.depositStatus} />,
      },
      {
        key: "rentAmount",
        header: "Tiền thuê (mô phỏng)",
        align: "right",
        cell: (row) => <span className="tabular font-semibold">{formatVnd(row.rentAmount)}</span>,
      },
      {
        key: "onchain",
        header: "On-chain",
        align: "center",
        cell: (row) => (
          <span className="tabular font-mono text-xs font-semibold text-ink/80">
            {row.onchain.confirmed}/{row.onchain.total}
          </span>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <AdminPageHeader
          title="Chi tiết người dùng"
          backHref="/admin/nguoi-dung"
          backLabel="Quay lại danh sách người dùng"
        />
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-brick/30 bg-brick/8 px-6 py-10 text-center"
        >
          <p className="text-base font-bold text-brick-ink">Không thể tải hồ sơ người dùng</p>
          <p className="text-sm text-ink/70">{error ?? "Không tìm thấy dữ liệu."}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-brick/35 bg-paper px-4 py-2 text-sm font-semibold text-brick-ink hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title={user.fullName ?? "Người dùng chưa đặt tên"}
        description="Chế độ chỉ xem hồ sơ cơ bản; không hiển thị giấy tờ tùy thân hay khóa bí mật."
        backHref="/admin/nguoi-dung"
        backLabel="Quay lại danh sách người dùng"
        badge={<AdminStatusPill kind="role" status={user.role} />}
      />

      {/* Hồ sơ tổng quan */}
      <section className="rounded-3xl border border-line bg-paper p-5 shadow-[0_10px_30px_-24px_rgb(20_33_61/0.22)]">
        <h2 className="mb-4 text-base font-bold text-ink">Thông tin tài khoản</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-ink/55">Số điện thoại (đã che)</dt>
            <dd className="tabular mt-1 font-mono text-sm font-semibold text-ink">
              {maskPhoneSafety(user.phoneMasked)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Ngày tạo tài khoản</dt>
            <dd className="tabular mt-1 text-sm font-semibold text-ink">
              {formatDate(user.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Hoạt động gần nhất</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {formatRelativeTime(user.lastActiveAt)}
              {user.lastActiveAt && (
                <span className="tabular ml-1.5 text-xs font-normal text-ink/55">
                  ({formatDateTime(user.lastActiveAt)})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Số hợp đồng tham gia</dt>
            <dd className="tabular mt-1 text-sm font-bold text-ink">{user.contractCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/55">Bảo mật Passkey</dt>
            <dd className="mt-1">
              <AdminStatusPill kind="passkey" enabled={user.hasPasskey} />
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="mb-1.5 text-xs font-semibold text-ink/55">Địa chỉ ví công khai (Stellar Testnet)</dt>
            <dd>
              <WalletAddressPill publicKey={user.walletPublicKey} />
            </dd>
          </div>
        </dl>
      </section>

      {/* Biểu đồ hoạt động 30 ngày */}
      <ActivityBarChart points={user.activityByDay} />

      {/* Danh sách hợp đồng */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-ink">Hợp đồng liên quan</h2>
          <p className="text-xs text-ink/60">Số tiền thuê hiển thị theo dữ liệu mô phỏng.</p>
        </div>
        <DataTable
          columns={contractColumns}
          rows={user.contracts}
          rowKey={(c) => c.id}
          animationKey={`user-contracts-${user.id}`}
          emptyTitle="Chưa có hợp đồng nào"
          emptyDescription="Người dùng này chưa tham gia hợp đồng thuê phòng nào."
        />
      </section>

      {/* Dòng thời gian sự kiện gần đây */}
      <EventTimeline events={user.recentEvents} />
    </div>
  );
}
