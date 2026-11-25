import Link from "next/link";
import type { AdminEvent } from "@/domain/admin/dto";
import { AdminStatusPill } from "@/components/admin/table";
import { formatDateTime, formatRelativeTime } from "./formatters";

export type EventTimelineProps = {
  events: AdminEvent[];
  title?: string;
  emptyText?: string;
};

function targetHref(target: AdminEvent["target"]): string | null {
  if (!target) return null;
  if (target.type === "contract") return `/admin/hop-dong/${target.id}`;
  if (target.type === "user") return `/admin/nguoi-dung/${target.id}`;
  return null;
}

export function EventTimeline({
  events,
  title = "Dòng thời gian sự kiện gần đây",
  emptyText = "Chưa có sự kiện nào được ghi nhận.",
}: EventTimelineProps) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-5 shadow-[0_10px_30px_-24px_rgb(20_33_61/0.22)]">
      <h2 className="mb-4 text-base font-bold text-ink">{title}</h2>

      {events.length === 0 ? (
        <p className="text-sm text-ink/60">{emptyText}</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {events.map((ev) => {
            const href = targetHref(ev.target);
            return (
              <li key={ev.id} className="relative">
                <span
                  className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-paper bg-primary"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink/55">
                  <span className="font-semibold text-ink/75">{formatRelativeTime(ev.at)}</span>
                  <span>·</span>
                  <span className="tabular">{formatDateTime(ev.at)}</span>
                  <AdminStatusPill kind="role" status={ev.actorRole} />
                </div>
                <p className="mt-1 text-sm font-medium text-ink">{ev.summary}</p>
                {href && ev.target && (
                  <Link
                    href={href}
                    className="mt-1 inline-block text-xs font-semibold text-primary-strong hover:underline"
                  >
                    Xem {ev.target.label} →
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
