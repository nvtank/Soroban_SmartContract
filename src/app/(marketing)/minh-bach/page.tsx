import Link from "next/link";
import { marketingVi } from "@/i18n/sections/marketing";
import { FACTS } from "@/content/facts";
import { vi } from "@/i18n/vi";
import { MockBadge } from "@/components/shared/MockBadge";
import {
  ShieldCheck,
  Lock,
  Database,
  Blocks,
  FileCheck,
  Info,
  ArrowLeft,
  Cpu,
} from "lucide-react";

export default function TransparencyPage() {
  const trans = marketingVi.transparency;
  const sections = trans.sections;

  return (
    <main className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      {/* Breadcrumb & Nút quay lại */}
      <div className="flex items-center gap-3 text-xs font-semibold text-ink/60">
        <Link
          href="/"
          className="flex items-center gap-1 hover:text-primary transition-colors"
          data-cursor-hover="true"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Trang chủ</span>
        </Link>
        <span>/</span>
        <span className="text-ink">{marketingVi.nav.transparency}</span>
      </div>

      {/* Header trang Minh bạch */}
      <div className="mt-8">
        <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary-strong w-fit max-w-full">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Tiêu chuẩn Đạo đức Blockchain & AI</span>
        </div>
        <h1 className="mt-4 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
          {trans.pageTitle}
        </h1>
        <p className="mt-4 text-base sm:text-lg leading-relaxed text-ink/80 max-w-3xl">
          {trans.pageSubtitle}
        </p>
      </div>

      {/* Nội dung các phần */}
      <div className="mt-16 flex flex-col gap-16">
        {/* Phần 1: Dữ liệu thu thập & Mục đích */}
        <section className="rounded-3xl border border-line bg-paper p-6 sm:p-10 shadow-soft">
          <h2 className="text-2xl font-bold text-ink">
            {sections.dataCollection.title}
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-ink/80">
            {sections.dataCollection.content}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {sections.dataCollection.items.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-line bg-surface/40 p-5 text-xs"
              >
                <div>
                  <span className="font-bold text-primary-strong text-sm">{item.field}</span>
                  <div className="mt-2 text-ink/75">
                    <span className="font-semibold text-ink">Thu thập từ: </span>
                    {item.source}
                  </div>
                </div>
                <div className="mt-3 border-t border-line/60 pt-2 text-ink/65">
                  <span className="font-semibold text-ink">Mục đích: </span>
                  {item.purpose}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Phần 2: Bảng phân định On-Chain và Off-Chain */}
        <section className="rounded-3xl border border-line bg-paper p-6 sm:p-10 shadow-soft">
          <h2 className="text-2xl font-bold text-ink">
            {sections.onOffChainTable.title}
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-ink/80">
            {sections.onOffChainTable.description}
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/80 font-bold text-ink">
                  <th className="p-4 w-1/4">Loại thông tin</th>
                  <th className="p-4 w-3/8 text-ink/80">
                    <div className="flex items-center gap-1.5">
                      <Database className="h-4 w-4" />
                      <span>{sections.onOffChainTable.offchainHeader}</span>
                    </div>
                  </th>
                  <th className="p-4 w-3/8 text-primary-strong bg-primary/5">
                    <div className="flex items-center gap-1.5">
                      <Blocks className="h-4 w-4" />
                      <span>{sections.onOffChainTable.onchainHeader}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {sections.onOffChainTable.items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface/20">
                    <td className="p-4 font-bold text-ink">{row.category}</td>
                    <td className="p-4 text-ink/75">{row.offchain}</td>
                    <td className="p-4 font-semibold text-primary-strong bg-primary/5">
                      {row.onchain}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Phần 3: Quyền riêng tư & Bảo mật */}
        <section className="rounded-3xl border border-line bg-paper p-6 sm:p-10 shadow-soft">
          <h2 className="text-2xl font-bold text-ink">
            {sections.privacySecurity.title}
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm sm:text-base text-ink/80">
            {sections.privacySecurity.points.map((point, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong mt-0.5">
                  <Lock className="h-3.5 w-3.5" />
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Phần 4: Bảo vệ tài sản & Tiền cọc */}
        <section className="rounded-3xl border border-line bg-paper p-6 sm:p-10 shadow-soft">
          <h2 className="text-2xl font-bold text-ink">
            {sections.assetProtection.title}
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm sm:text-base text-ink/80">
            {sections.assetProtection.points.map((point, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong mt-0.5">
                  <FileCheck className="h-3.5 w-3.5" />
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Phần 5: Đạo đức AI (Khẳng định bản demo không dùng AI quyết định) */}
        <section className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 sm:p-10 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
            <Cpu className="h-4 w-4" />
            <span>Tuyên bố Đạo đức Trí tuệ Nhân tạo</span>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold text-primary-strong">
            {sections.aiEthics.title}
          </h2>
          <div className="mt-4 rounded-2xl border border-primary/20 bg-paper p-5 text-sm sm:text-base font-semibold leading-relaxed text-ink">
            {sections.aiEthics.declaration}
          </div>
          <p className="mt-4 text-xs sm:text-sm leading-relaxed text-ink/75">
            {sections.aiEthics.detail}
          </p>
        </section>

        {/* Phần 6: Danh mục thành phần mô phỏng trong bản demo */}
        <section className="rounded-3xl border border-dashed border-amber-ink/40 bg-amber/10 p-6 sm:p-10">
          <div className="flex items-center gap-2">
            <MockBadge label="TRUNG THỰC VỀ BẢN DEMO" />
          </div>
          <h2 className="mt-2 text-2xl font-bold text-amber-ink">
            {sections.simulationList.title}
          </h2>
          <p className="mt-2 text-sm text-amber-ink/90">
            {sections.simulationList.notice}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sections.simulationList.items.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-amber-ink/20 bg-paper p-5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{item.feature}</span>
                    <MockBadge label={item.status} />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-ink/75">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Phần 7: Lộ trình hoàn thiện pháp lý và kỹ thuật */}
        <section className="rounded-3xl border border-line bg-paper p-6 sm:p-10 shadow-soft">
          <h2 className="text-2xl font-bold text-ink">{sections.roadmap.title}</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm sm:text-base text-ink/80">
            {sections.roadmap.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-xs font-bold text-ink mt-0.5">
                  0{idx + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Phần 8: Nguồn số liệu từ FACTS có kèm nhãn Chưa xác minh nguồn */}
        <section className="rounded-3xl border border-line bg-surface/50 p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-ink">
            {sections.factsVerification.title}
          </h2>
          <p className="mt-2 text-sm text-ink/70">
            {sections.factsVerification.description}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FACTS.map((fact) => (
              <div
                key={fact.id}
                className="flex flex-col rounded-2xl border border-line bg-paper p-5 shadow-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="tabular font-sans text-2xl sm:text-3xl font-black text-primary-strong">
                    {new Intl.NumberFormat("vi-VN").format(fact.value)}
                  </span>
                  <span className="text-sm font-bold text-ink/80">{fact.unit}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-ink/80">{fact.label}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3 text-xs text-ink/60">
                  <span className="font-semibold">Nguồn: {fact.source ?? "Tài liệu sơ bộ brief"}</span>
                  {!fact.verified && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber/20 px-2 py-0.5 text-[11px] font-bold text-amber-ink">
                      <Info className="h-3 w-3" />
                      <span>{vi.common.unverifiedSource}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
