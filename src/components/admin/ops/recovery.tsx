"use client";

import { useCallback, useRef, useState } from "react";
import type { AdminRecoveryRow } from "@/domain/admin/dto";
import { adminApi } from "@/lib/admin/api-client";
import {
  AnimatedNumber,
  buttonClass,
  cardClass,
  InlineConfirm,
  maskPhones,
  OpsEnter,
  OpsPage,
  ResourceMessage,
  Timestamp,
  tones,
} from "./ops-ui";
import { adminFixturesEnabled, useOpsResource } from "./use-ops-resource";

export function RecoveryOps() {
  const approvedFixtures = useRef(new Set<string>());
  const load = useCallback(async () => {
    const result = await adminApi.recovery();
    return result.filter((row) => row.status === "PENDING" && !approvedFixtures.current.has(row.id));
  }, []);
  const { data, failed, reload, update } = useOpsResource(load);
  const [confirmation, setConfirmation] = useState<string>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function approve(row: AdminRecoveryRow) {
    setPending(true);
    setMessage("");
    setError("");
    try {
      await adminApi.approveRecovery(row.id);
      if (adminFixturesEnabled) approvedFixtures.current.add(row.id);
      update((rows) => rows.filter(({ id }) => id !== row.id));
      setConfirmation(undefined);
      setMessage(`Đã duyệt yêu cầu khôi phục của ${maskPhones(row.userLabel)}.`);
      reload();
    } catch {
      setError("Không thể duyệt yêu cầu. Hãy tải lại để kiểm tra trạng thái.");
    } finally {
      setPending(false);
    }
  }

  return (
    <OpsPage
      title="Khôi phục tài khoản"
      description="Duyệt các yêu cầu cấp lại quyền truy cập. Bước eKYC trong chế độ demo là mô phỏng."
    >
      <ResourceMessage failed={failed} hasData={!!data} reload={reload} />
      {message && (
        <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary-strong">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-brick/10 px-4 py-3 text-sm text-brick-ink">
          {error}
        </p>
      )}
      {data && (
        <section aria-labelledby="recovery-heading" className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="recovery-heading" className="font-bold">
                Yêu cầu chờ duyệt
              </h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones.warn}`}>
                <AnimatedNumber value={data.length} />
              </span>
            </div>
            <button type="button" className={buttonClass} onClick={reload} disabled={pending}>
              Làm mới
            </button>
          </div>
          {data.length ? (
            <OpsEnter>
              <ul aria-label="Yêu cầu khôi phục" className="divide-y divide-line border-t border-line">
                {data.map((row) => (
                  <li key={row.id} data-ops-enter className="space-y-3 p-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                        <h3 className="text-sm font-bold">{maskPhones(row.userLabel)}</h3>
                        <p className="text-sm text-ink/65">
                          <span className="font-mono">{maskPhones(row.phoneMasked)}</span> ·{" "}
                          <Timestamp value={row.createdAt} />
                        </p>
                      </div>
                      {confirmation !== row.id && (
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={pending}
                          onClick={() => {
                            setConfirmation(row.id);
                            setError("");
                          }}
                        >
                          Duyệt
                        </button>
                      )}
                    </div>
                    {confirmation === row.id && (
                      <InlineConfirm
                        prompt={`Duyệt yêu cầu khôi phục của ${maskPhones(row.userLabel)}?`}
                        action="Xác nhận duyệt"
                        pending={pending}
                        onCancel={() => setConfirmation(undefined)}
                        onConfirm={() => void approve(row)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </OpsEnter>
          ) : (
            <p className="border-t border-line px-5 py-8 text-sm text-ink/65">Không có yêu cầu chờ duyệt.</p>
          )}
        </section>
      )}
    </OpsPage>
  );
}
