"use client";

import { useId, useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

const timeZone = "Asia/Ho_Chi_Minh";
export const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone, dateStyle: "long" });
export const timeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone, timeStyle: "short" });
const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone, dateStyle: "short", timeStyle: "short" });
export const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

export const cardClass = "min-w-0 rounded-card border border-line bg-white/65 shadow-xs";
export const buttonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary-strong disabled:cursor-not-allowed disabled:opacity-50";
export const primaryButtonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full bg-primary-strong px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

export const tones = {
  good: "bg-primary/10 text-primary-strong",
  warn: "bg-amber/20 text-amber-ink",
  bad: "bg-brick/10 text-brick-ink",
  neutral: "bg-ink/5 text-ink/75",
};

export function OpsPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-6 text-ink sm:px-6 sm:py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink/70">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function OpsEnter({ children, className }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const motion = gsap.matchMedia();
      motion.add("(prefers-reduced-motion: no-preference)", () => {
        const targets = scope.current?.querySelectorAll("[data-ops-enter]");
        if (!targets?.length) return;
        gsap.from(targets, {
          y: 7,
          opacity: 0,
          duration: 0.28,
          stagger: 0.045,
          ease: "power2.out",
        });
      });
      return () => motion.revert();
    },
    { scope },
  );
  return (
    <div className={className} ref={scope}>
      {children}
    </div>
  );
}

export function AnimatedNumber({ value }: { value: number | null }) {
  const target = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const motion = gsap.matchMedia();
      motion.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(target.current, { y: 4, opacity: 0.55, duration: 0.23, ease: "power2.out" });
      });
      return () => motion.revert();
    },
    { scope: target, dependencies: [value], revertOnUpdate: true },
  );
  return (
    <span ref={target} className="inline-block tabular-nums">
      {value === null ? "—" : numberFormat.format(value)}
    </span>
  );
}

export function StatusDot({ tone, label }: { tone: keyof typeof tones; label: string }) {
  const target = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const motion = gsap.matchMedia();
      motion.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(target.current, {
          scale: 0.75,
          opacity: 0.5,
          duration: 1.25,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
      return () => motion.revert();
    },
    { scope: target },
  );
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      <span ref={target} aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function InlineConfirm({
  prompt,
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  prompt: string;
  action: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="space-y-3 rounded-xl border border-amber/40 bg-amber/10 p-3"
    >
      <p id={labelId} className="text-sm font-medium text-ink">
        {prompt}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass} disabled={pending} onClick={onConfirm}>
          {pending ? "Đang xử lý…" : action}
        </button>
        <button type="button" className={buttonClass} disabled={pending} onClick={onCancel}>
          Hủy
        </button>
      </div>
    </div>
  );
}

export function ResourceMessage({
  failed,
  hasData,
  reload,
}: {
  failed: boolean;
  hasData: boolean;
  reload: () => void;
}) {
  if (failed) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-brick/25 bg-brick/5 p-4 text-sm text-brick-ink"
      >
        <p>
          {hasData ? "Không thể làm mới. Đang hiển thị dữ liệu lần tải gần nhất." : "Không thể tải dữ liệu."}
        </p>
        <button type="button" className={buttonClass} onClick={reload}>
          Tải lại
        </button>
      </div>
    );
  }
  return !hasData ? (
    <p role="status" className={`${cardClass} p-5 text-sm text-ink/70`}>
      Đang tải dữ liệu…
    </p>
  ) : null;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink/70"
    >
      <span>
        Trang {page} / {pageCount} · {numberFormat.format(total)} mục
      </span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Trang trước
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Trang sau
        </button>
      </div>
    </nav>
  );
}

export function Timestamp({ value }: { value: string }) {
  return <time dateTime={value}>{dateTimeFormat.format(new Date(value))}</time>;
}

export function maskPhones(text: string) {
  return text.replace(/(?:\+84|\b0|\b84)[ .-]?(?:\d[ .-]?){8,9}\d\b/g, (phone) => {
    const digits = phone.replace(/\D/g, "");
    return `${phone.startsWith("+") ? "+" : ""}${digits.slice(0, 3)}***${digits.slice(-4)}`;
  });
}
