"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import type { AdminAuditRow, ListQuery, Page } from "@/domain/admin/dto";
import { adminApi } from "@/lib/admin/api-client";
import {
  buttonClass,
  cardClass,
  dateFormat,
  inputClass,
  maskPhones,
  OpsEnter,
  OpsPage,
  Pagination,
  primaryButtonClass,
  ResourceMessage,
  timeFormat,
  tones,
} from "./ops-ui";
import { adminFixturesEnabled, useOpsResource } from "./use-ops-resource";

const pageSize = 20;
const roleLabels: Record<AdminAuditRow["actorRole"], string> = {
  ADMIN_DEMO: "Quản trị viên",
  LANDLORD: "Chủ nhà",
  TENANT: "Người thuê",
  SYSTEM: "Hệ thống",
};

async function loadAudit(query: ListQuery & { action?: string }, page: number): Promise<Page<AdminAuditRow>> {
  if (!adminFixturesEnabled || !query.action) return adminApi.audit(query);

  const first = await adminApi.audit({ q: query.q, pageSize: 100 });
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(first.total / first.pageSize) - 1 }, (_, index) =>
      adminApi.audit({ q: query.q, page: index + 2, pageSize: first.pageSize }),
    ),
  );
  const rows = [first, ...rest].flatMap(({ items }) => items).filter((row) => row.action === query.action);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length };
}

export function AuditOps() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [query, setQuery] = useState({ q: "", action: "", page: 1 });
  const actionOptionsId = useId();
  const load = useCallback(() => loadAudit({ ...query, pageSize }, query.page), [query]);
  const { data, failed, reload } = useOpsResource(load);
  const actionOptions = Array.from(
    new Set(["LOGIN", "LOGOUT", ...(data?.items.map((row) => row.action) ?? [])]),
  ).sort();
  const grouped = new Map<string, AdminAuditRow[]>();
  for (const row of data?.items ?? []) {
    const day = dateFormat.format(new Date(row.at));
    const events = grouped.get(day) ?? [];
    events.push(row);
    grouped.set(day, events);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery({ q: search.trim(), action: action.trim().toUpperCase(), page: 1 });
  }

  return (
    <OpsPage
      title="Nhật ký kiểm toán"
      description="Theo dõi hoạt động theo ngày (giờ Việt Nam). Các thao tác quản trị được đánh dấu trong dòng thời gian."
    >
      <form
        onSubmit={applyFilters}
        className={`${cardClass} grid items-end gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:p-5`}
      >
        <label className="space-y-2 text-sm font-semibold">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClass}
            placeholder="Ví dụ LOGIN"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Hành động</span>
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className={inputClass}
            list={actionOptionsId}
            placeholder="Tất cả hành động"
            autoComplete="off"
          />
          <datalist id={actionOptionsId}>
            {actionOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={primaryButtonClass} type="submit">
            Lọc nhật ký
          </button>
          {(query.q || query.action) && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setSearch("");
                setAction("");
                setQuery({ q: "", action: "", page: 1 });
              }}
            >
              Xóa lọc
            </button>
          )}
        </div>
      </form>
      <ResourceMessage failed={failed} hasData={!!data} reload={reload} />
      {data && (
        <>
          {!grouped.size && (
            <p className={`${cardClass} p-5 text-sm text-ink/65`}>Không tìm thấy hoạt động phù hợp.</p>
          )}
          <OpsEnter key={`${query.q}/${query.action}/${query.page}`} className="space-y-6">
            {[...grouped].map(([day, events]) => (
              <section key={day} data-ops-enter aria-label={day}>
                <h2 className="mb-3 text-sm font-bold text-ink/75">{day}</h2>
                <ol className="ml-1.5 space-y-3 border-l border-line pl-4 sm:pl-6">
                  {events.map((event) => {
                    const admin = event.action.startsWith("ADMIN_");
                    return (
                      <li key={event.id} className="relative">
                        <span
                          aria-hidden="true"
                          className={`absolute top-5 -left-[22px] size-2.5 rounded-full ring-4 ring-paper sm:-left-[30px] ${admin ? "bg-primary" : "bg-ink/25"}`}
                        />
                        <article
                          className={`${cardClass} ${admin ? "border-primary/40 bg-primary/5" : ""} space-y-2 p-4 [overflow-wrap:anywhere] sm:px-5`}
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <time
                              dateTime={event.at}
                              className="text-xs font-medium tabular-nums text-ink/65"
                            >
                              {timeFormat.format(new Date(event.at))}
                            </time>
                            <code
                              className={`max-w-full rounded-lg px-2 py-1 text-xs font-bold ${admin ? tones.good : tones.neutral}`}
                            >
                              {event.action}
                            </code>
                            {admin && <span className="text-xs font-bold text-primary-strong">Quản trị</span>}
                          </div>
                          <p className="text-sm font-semibold">
                            {event.actorLabel ? `${maskPhones(event.actorLabel)} · ` : ""}
                            {roleLabels[event.actorRole]}
                          </p>
                          {event.detail && (
                            <p className="text-sm leading-6 text-ink/70">{maskPhones(event.detail)}</p>
                          )}
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </OpsEnter>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(page) => setQuery({ ...query, page })}
          />
        </>
      )}
    </OpsPage>
  );
}
